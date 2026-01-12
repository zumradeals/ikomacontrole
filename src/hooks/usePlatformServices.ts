import { useMemo } from 'react';
import { useInfrastructures, Infrastructure } from './useInfrastructures';
import { useRunners } from './useRunners';
import { useOrders, Order } from './useOrders';
import { Database, Zap, Globe, BarChart3, LucideIcon } from 'lucide-react';

// Service status enum
export type ServiceStatus = 
  | 'not_configured'    // No infra selected or no runner
  | 'precheck_failed'   // Prerequisites not met
  | 'ready_to_install'  // Prerequisites OK, ready to install
  | 'installing'        // Installation in progress
  | 'installed'         // Service installed and verified
  | 'failed'            // Installation failed
  | 'stopped';          // Service installed but stopped

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
    logs?: string;
  };
  prerequisites: string[];
  lastOrder?: Order;
}

export interface PlatformGating {
  hasInfra: boolean;
  hasRunner: boolean;
  runnerOnline: boolean;
  dockerInstalled: boolean;
  dockerComposeInstalled: boolean;
  allMet: boolean;
  missing: string[];
}

interface Runner {
  id: string;
  name: string;
  status: string;
  infrastructure_id: string | null;
  capabilities: Record<string, unknown>;
}

// Service definitions
const SERVICE_DEFINITIONS = [
  {
    id: 'caddy',
    name: 'Caddy',
    description: 'Reverse proxy avec HTTPS automatique',
    icon: Globe,
    capabilities: {
      required: [],
      verifies: 'caddy.installed',
    },
    playbooks: {
      precheck: undefined,
      install: ['proxy.caddy.install'],
      status: 'maintenance.services.status',
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
      install: ['supabase.selfhost.pull'],
      status: 'supabase.precheck',
    },
    prerequisites: ['docker.installed', 'docker.compose.installed', 'git.installed'],
  },
];

function getCapabilityValue(capabilities: Record<string, unknown>, key: string): string {
  const value = capabilities?.[key];
  if (typeof value === 'string') return value;
  return 'unknown';
}

function computeServiceStatus(
  service: typeof SERVICE_DEFINITIONS[0],
  capabilities: Record<string, unknown>,
  orders: Order[],
  gating: PlatformGating
): { status: ServiceStatus; label: string; lastOrder?: Order } {
  // If no infrastructure or runner, not configured
  if (!gating.hasInfra || !gating.hasRunner) {
    return { status: 'not_configured', label: 'Non configuré' };
  }

  // Check if service is already installed
  const isInstalled = getCapabilityValue(capabilities, service.capabilities.verifies) === 'installed';
  if (isInstalled) {
    return { status: 'installed', label: 'Installé' };
  }

  // Find the most recent order for this service
  const serviceOrders = orders.filter(o => 
    service.playbooks.install.some(pb => o.description?.includes(`[${pb}]`)) ||
    (service.playbooks.precheck && o.description?.includes(`[${service.playbooks.precheck}]`))
  );
  const lastOrder = serviceOrders[0];

  // Check if there's an order in progress
  if (lastOrder?.status === 'running' || lastOrder?.status === 'pending') {
    return { status: 'installing', label: 'Installation en cours', lastOrder };
  }

  // Check if last order failed
  if (lastOrder?.status === 'failed') {
    return { status: 'failed', label: 'Échec installation', lastOrder };
  }

  // Check prerequisites (Docker requirements)
  const missingPrereqs = service.prerequisites.filter(prereq => {
    const value = getCapabilityValue(capabilities, prereq);
    return value !== 'installed' && value !== 'verified';
  });

  if (missingPrereqs.length > 0) {
    return { status: 'precheck_failed', label: 'Prérequis manquants' };
  }

  // Ready to install
  return { status: 'ready_to_install', label: 'Prêt à installer' };
}

export function usePlatformServices(selectedInfraId?: string) {
  const { data: infrastructures = [] } = useInfrastructures();
  const { data: runners = [] } = useRunners();
  
  // Find selected infrastructure
  const selectedInfra = useMemo(() => {
    if (!selectedInfraId) return undefined;
    return infrastructures.find(i => i.id === selectedInfraId);
  }, [infrastructures, selectedInfraId]);

  // Find runner associated with this infrastructure
  const associatedRunner = useMemo(() => {
    if (!selectedInfraId) return undefined;
    return (runners as Runner[]).find(r => r.infrastructure_id === selectedInfraId);
  }, [runners, selectedInfraId]);

  // Get orders for this runner
  const { data: orders = [] } = useOrders(associatedRunner?.id);

  // Compute capabilities from infrastructure
  const capabilities = useMemo(() => {
    if (!selectedInfra) return {};
    return (selectedInfra.capabilities as Record<string, unknown>) || {};
  }, [selectedInfra]);

  // Compute gating
  const gating: PlatformGating = useMemo(() => {
    const hasInfra = !!selectedInfra;
    const hasRunner = !!associatedRunner;
    const runnerOnline = associatedRunner?.status === 'online';
    const dockerInstalled = getCapabilityValue(capabilities, 'docker.installed') === 'installed';
    const dockerComposeInstalled = getCapabilityValue(capabilities, 'docker.compose.installed') === 'installed';
    
    const missing: string[] = [];
    if (!hasInfra) missing.push('Infrastructure non sélectionnée');
    if (!hasRunner) missing.push('Aucun runner associé');
    if (!runnerOnline && hasRunner) missing.push('Runner hors ligne');
    if (!dockerInstalled) missing.push('Docker non installé');
    if (!dockerComposeInstalled) missing.push('Docker Compose non installé');

    return {
      hasInfra,
      hasRunner,
      runnerOnline,
      dockerInstalled,
      dockerComposeInstalled,
      allMet: hasInfra && hasRunner && runnerOnline && dockerInstalled && dockerComposeInstalled,
      missing,
    };
  }, [selectedInfra, associatedRunner, capabilities]);

  // Compute services with status
  const services: PlatformService[] = useMemo(() => {
    return SERVICE_DEFINITIONS.map(def => {
      const { status, label, lastOrder } = computeServiceStatus(def, capabilities, orders, gating);
      return {
        ...def,
        status,
        statusLabel: label,
        lastOrder,
      };
    });
  }, [capabilities, orders, gating]);

  return {
    infrastructures,
    runners: runners as Runner[],
    selectedInfra,
    associatedRunner,
    capabilities,
    gating,
    services,
    orders,
  };
}

// Prerequisite playbooks for installing base requirements
export const PREREQUISITE_PLAYBOOKS = [
  'system.packages.base',
  'docker.install_engine',
  'docker.install_compose',
];
