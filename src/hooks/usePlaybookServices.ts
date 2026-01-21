/**
 * PLAYBOOK SERVICES HOOK
 * 
 * Provides server/runner data from the external API for playbook execution.
 * Replaces the old usePlatformServices that used local Supabase data.
 * 
 * Source of truth:
 * - Servers & Runners: External API via admin-proxy
 * - Orders: Local Supabase (created here, polled by runners)
 * - Capabilities: External API (stored on runner)
 */

import { useMemo } from 'react';
import { useEnrichedServers, ProxyRunner } from './useApiServers';
import { useOrders, Order } from './useOrders';
import { parseRunnerCapabilities, RunnerCapabilities, hasCapability } from './useRunnerCapabilities';
import { LucideIcon, Database, Zap, Globe, BarChart3 } from 'lucide-react';

// Service status enum
export type ServiceStatus = 
  | 'not_configured'    // No server selected or no runner
  | 'precheck_failed'   // Prerequisites not met
  | 'ready_to_install'  // Prerequisites OK, ready to install
  | 'installing'        // Installation in progress
  | 'installed'         // Service installed
  | 'failed'            // Installation failed
  | 'stopped'           // Service installed but stopped
  | 'unknown'           // Status unknown
  | 'stale'             // Verification is old or runner offline
  | 'checking';         // Verification in progress

export interface RuntimeVerification {
  installed: boolean;
  running: boolean;
  version: string;
  https_ready: boolean;
  checked_at: string | null;
  error: string | null;
}

export interface PlatformService {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  status: ServiceStatus;
  statusLabel: string;
  capabilities: {
    required: string[];
    verifies: string;
  };
  playbooks: {
    precheck?: string;
    install: string[];
    status?: string;
    verify?: string;
  };
  prerequisites: string[];
  lastOrder?: Order;
  runtimeVerification?: RuntimeVerification | null;
}

export interface PlaybookGating {
  hasServer: boolean;
  hasRunner: boolean;
  runnerOnline: boolean;
  allMet: boolean;
  missing: string[];
}

// Service definitions
const SERVICE_DEFINITIONS = [
  {
    id: 'caddy',
    name: 'Caddy',
    description: 'Reverse proxy avec HTTPS automatique',
    icon: Globe,
    capabilities: { required: [], verifies: 'caddy.installed' },
    playbooks: {
      install: ['proxy.caddy.install'],
      status: 'proxy.caddy.status',
      verify: 'proxy.caddy.verify',
    },
    prerequisites: [],
  },
  {
    id: 'nginx',
    name: 'Nginx + Certbot',
    description: 'Reverse proxy avec Let\'s Encrypt HTTPS',
    icon: Globe,
    capabilities: { required: [], verifies: 'nginx.installed' },
    playbooks: {
      install: ['proxy.nginx.install_full'],
      status: 'proxy.nginx.status',
      verify: 'proxy.nginx.verify',
    },
    prerequisites: [],
  },
  {
    id: 'redis',
    name: 'Redis',
    description: 'Cache et store clé-valeur en mémoire',
    icon: Zap,
    capabilities: {
      required: ['docker.installed', 'docker.compose.installed'],
      verifies: 'redis.installed',
    },
    playbooks: {
      install: ['docker.install_engine', 'docker.install_compose'],
      status: 'maintenance.services.status',
    },
    prerequisites: ['docker.installed', 'docker.compose.installed'],
  },
  {
    id: 'prometheus',
    name: 'Prometheus',
    description: 'Collecte et stockage de métriques',
    icon: BarChart3,
    capabilities: {
      required: ['docker.installed', 'docker.compose.installed'],
      verifies: 'prometheus.installed',
    },
    playbooks: {
      install: ['monitor.node_exporter.install'],
      status: 'maintenance.services.status',
    },
    prerequisites: ['docker.installed', 'docker.compose.installed'],
  },
  {
    id: 'supabase',
    name: 'Supabase',
    description: 'Backend self-hosted complet',
    icon: Database,
    capabilities: {
      required: ['docker.installed', 'docker.compose.installed', 'git.installed'],
      verifies: 'supabase.installed',
    },
    playbooks: {
      precheck: 'supabase.precheck',
      install: ['supabase.selfhost.pull_stack', 'supabase.selfhost.configure_env', 'supabase.selfhost.up', 'supabase.selfhost.healthcheck'],
      status: 'supabase.selfhost.healthcheck',
    },
    prerequisites: ['docker.installed', 'docker.compose.installed', 'git.installed'],
  },
];

const RUNNER_OFFLINE_THRESHOLD_MS = 60 * 1000; // 60 seconds

// Check if runner is online based on last heartbeat
function isRunnerOnline(runner: ProxyRunner | undefined): boolean {
  if (!runner) return false;
  if (runner.status === 'ONLINE') return true;
  if (!runner.lastHeartbeatAt) return false;
  const lastSeen = new Date(runner.lastHeartbeatAt);
  return Date.now() - lastSeen.getTime() < RUNNER_OFFLINE_THRESHOLD_MS;
}

export function usePlaybookServices(selectedServerId?: string) {
  const { 
    data: servers = [], 
    runners = [], 
    runnersById,
    isLoading,
    error,
    refetch
  } = useEnrichedServers();

  // Find selected server
  const selectedServer = useMemo(() => {
    if (!selectedServerId) return undefined;
    return servers.find(s => s.id === selectedServerId);
  }, [servers, selectedServerId]);

  // Find runner associated with this server
  const associatedRunner = useMemo((): ProxyRunner | undefined => {
    if (!selectedServer?.runnerId) return undefined;
    return runnersById.get(selectedServer.runnerId);
  }, [selectedServer, runnersById]);

  // Parse capabilities from runner (now from external API)
  const capabilities = useMemo((): RunnerCapabilities => {
    if (!associatedRunner) return {};
    return parseRunnerCapabilities(associatedRunner.capabilities);
  }, [associatedRunner]);

  // Get orders for this runner (from local Supabase)
  const { data: orders = [] } = useOrders(associatedRunner?.id);

  // Compute gating conditions
  const gating = useMemo((): PlaybookGating => {
    const hasServer = !!selectedServer;
    const hasRunner = !!associatedRunner;
    const runnerOnline = isRunnerOnline(associatedRunner);
    
    const missing: string[] = [];
    if (!hasServer) missing.push('Serveur non sélectionné');
    if (!hasRunner) missing.push('Aucun agent associé');
    if (!runnerOnline && hasRunner) missing.push('Agent hors ligne');

    return {
      hasServer,
      hasRunner,
      runnerOnline,
      allMet: hasServer && hasRunner && runnerOnline,
      missing,
    };
  }, [selectedServer, associatedRunner]);

  // Compute services with their status (checking capabilities from API)
  const services = useMemo((): PlatformService[] => {
    return SERVICE_DEFINITIONS.map(def => {
      let status: ServiceStatus = 'unknown';
      let statusLabel = 'Statut inconnu';
      let lastOrder: Order | undefined;

      if (!gating.hasServer || !gating.hasRunner) {
        status = 'not_configured';
        statusLabel = 'Non configuré';
      } else {
        // Check if prerequisites are met using capabilities from API
        const prereqsMet = def.prerequisites.every(prereq => 
          hasCapability(capabilities, prereq)
        );

        // Check if service is already installed
        const isInstalled = hasCapability(capabilities, def.capabilities.verifies);

        // Find orders related to this service
        const serviceOrders = orders.filter(o => 
          def.playbooks.install.some(pb => o.description?.includes(`[${pb}]`)) ||
          (def.playbooks.verify && o.description?.includes(`[${def.playbooks.verify}]`))
        );
        lastOrder = serviceOrders[0];

        if (isInstalled) {
          status = 'installed';
          statusLabel = 'Installé';
        } else if (lastOrder?.status === 'running' || lastOrder?.status === 'pending') {
          status = 'installing';
          statusLabel = 'Installation en cours';
        } else if (lastOrder?.status === 'failed') {
          status = 'failed';
          statusLabel = 'Échec';
        } else if (!prereqsMet) {
          status = 'precheck_failed';
          statusLabel = 'Prérequis manquants';
        } else {
          status = 'ready_to_install';
          statusLabel = 'Prêt à installer';
        }
      }

      return {
        ...def,
        status,
        statusLabel,
        lastOrder,
      };
    });
  }, [gating, orders, capabilities]);

  return {
    // Data
    servers,
    runners,
    runnersById,
    selectedServer,
    associatedRunner,
    orders,
    services,
    gating,
    capabilities,
    
    // Loading states
    isLoading,
    error,
    refetch,
  };
}
