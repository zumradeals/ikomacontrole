import { useMemo } from 'react';
import { useInfrastructures, Infrastructure } from './useInfrastructures';
import { useRunners } from './useRunners';
import { useOrders, Order } from './useOrders';
import { Database, Zap, Globe, BarChart3, LucideIcon } from 'lucide-react';

// Service status enum - Updated with runtime verification states
export type ServiceStatus = 
  | 'not_configured'    // No infra selected or no runner
  | 'precheck_failed'   // Prerequisites not met
  | 'ready_to_install'  // Prerequisites OK, ready to install
  | 'installing'        // Installation in progress
  | 'installed'         // Service installed and verified (runtime proof)
  | 'failed'            // Installation failed
  | 'stopped'           // Service installed but stopped
  | 'unknown'           // No runtime verification ever done
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
    logs?: string;
  };
  prerequisites: string[];
  lastOrder?: Order;
  // Runtime verification data
  runtimeVerification?: RuntimeVerification | null;
  lastVerifiedAt?: Date | null;
  staleReason?: string | null;
  isVerifying?: boolean;
}

export interface PlatformGating {
  hasInfra: boolean;
  hasRunner: boolean;
  runnerOnline: boolean;
  dockerInstalled: boolean;
  dockerComposeInstalled: boolean;
  allMet: boolean;
  missing: string[];
  // Caddy runtime status for deployment gating
  caddyVerified: boolean;
  caddyHttpsReady: boolean;
  // Nginx runtime status for deployment gating
  nginxVerified: boolean;
  nginxHttpsReady: boolean;
  // Combined proxy status (either Caddy or Nginx is ready)
  proxyReady: boolean;
}

interface Runner {
  id: string;
  name: string;
  status: string;
  infrastructure_id: string | null;
  capabilities: Record<string, unknown>;
  last_seen_at?: string | null;
}

// Service definitions with verify playbook for reverse proxies
const SERVICE_DEFINITIONS = [
  {
    id: 'caddy',
    name: 'Caddy',
    description: 'Reverse proxy avec HTTPS automatique (legacy)',
    icon: Globe,
    capabilities: {
      required: [],
      verifies: 'caddy.installed',
    },
    playbooks: {
      precheck: undefined,
      install: ['proxy.caddy.install'],
      status: 'proxy.caddy.status',
      verify: 'proxy.caddy.verify', // Runtime verification playbook
    },
    prerequisites: [],
  },
  {
    id: 'nginx',
    name: 'Nginx + Certbot',
    description: 'Reverse proxy avec Let\'s Encrypt HTTPS',
    icon: Globe,
    capabilities: {
      required: [],
      verifies: 'nginx.installed',
    },
    playbooks: {
      precheck: undefined,
      install: ['proxy.nginx.install_full'],
      status: 'proxy.nginx.status',
      verify: 'proxy.nginx.verify', // Runtime verification playbook
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

const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
const RUNNER_OFFLINE_THRESHOLD_MS = 60 * 1000; // 60 seconds

function getCapabilityValue(capabilities: Record<string, unknown>, key: string): string {
  const value = capabilities?.[key];
  if (typeof value === 'string') return value;
  return 'unknown';
}

// Parse runtime verification from order stdout for Caddy
function parseRuntimeVerificationFromOrder(order: Order, serviceName: string = 'caddy'): RuntimeVerification | null {
  if (!order.stdout_tail) return null;
  
  try {
    const regex = new RegExp(`\\{[\\s\\S]*"service"\\s*:\\s*"${serviceName}"[\\s\\S]*\\}`);
    const jsonMatch = order.stdout_tail.match(regex);
    if (!jsonMatch) return null;
    
    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed.service !== serviceName) return null;
    
    return {
      installed: parsed.installed === true,
      running: parsed.running === true,
      version: parsed.version || 'unknown',
      https_ready: parsed.https_ready === true,
      checked_at: parsed.checked_at || null,
      error: parsed.error || null,
    };
  } catch {
    return null;
  }
}

// Check if runner is online based on last seen
function isRunnerOnline(lastSeenAt: string | null | undefined): boolean {
  if (!lastSeenAt) return false;
  const lastSeen = new Date(lastSeenAt);
  return Date.now() - lastSeen.getTime() < RUNNER_OFFLINE_THRESHOLD_MS;
}

// Compute Caddy service status with runtime verification
function computeProxyStatus(
  serviceName: 'caddy' | 'nginx',
  capabilities: Record<string, unknown>,
  orders: Order[],
  gating: Omit<PlatformGating, 'caddyVerified' | 'caddyHttpsReady' | 'nginxVerified' | 'nginxHttpsReady' | 'proxyReady'>,
  runnerLastSeenAt: string | null | undefined
): { 
  status: ServiceStatus; 
  label: string; 
  lastOrder?: Order;
  runtimeVerification?: RuntimeVerification | null;
  lastVerifiedAt?: Date | null;
  staleReason?: string | null;
  isVerifying?: boolean;
} {
  // If no infrastructure or runner, not configured
  if (!gating.hasInfra || !gating.hasRunner) {
    return { status: 'not_configured', label: 'Non configuré' };
  }

  const verifyPlaybookId = serviceName === 'nginx' ? 'proxy.nginx.verify' : 'proxy.caddy.verify';
  const installPlaybookId = serviceName === 'nginx' ? 'proxy.nginx.install_full' : 'proxy.caddy.install';
  const capabilityKey = serviceName === 'nginx' ? 'nginx.installed' : 'caddy.installed';

  // Find verify orders
  const verifyOrders = orders.filter(o => 
    o.description?.includes(`[${verifyPlaybookId}]`)
  );
  const lastVerifyOrder = verifyOrders[0];
  
  // Find install orders
  const installOrders = orders.filter(o => 
    o.description?.includes(`[${installPlaybookId}]`)
  );
  const lastInstallOrder = installOrders[0];
  
  // Check if verification is in progress
  if (lastVerifyOrder?.status === 'running' || lastVerifyOrder?.status === 'pending') {
    return { 
      status: 'checking', 
      label: 'Vérification...', 
      lastOrder: lastVerifyOrder,
      isVerifying: true,
    };
  }
  
  // Check if installation is in progress
  if (lastInstallOrder?.status === 'running' || lastInstallOrder?.status === 'pending') {
    return { 
      status: 'installing', 
      label: 'Installation en cours', 
      lastOrder: lastInstallOrder 
    };
  }
  
  // Parse runtime verification from last completed verify order
  let runtimeVerification: RuntimeVerification | null = null;
  let lastVerifiedAt: Date | null = null;
  
  if (lastVerifyOrder?.status === 'completed') {
    runtimeVerification = parseRuntimeVerificationFromOrder(lastVerifyOrder, serviceName);
    if (runtimeVerification?.checked_at) {
      lastVerifiedAt = new Date(runtimeVerification.checked_at);
    }
  }
  
  // Check for stale conditions
  const runnerOnline = isRunnerOnline(runnerLastSeenAt);
  
  // Runner offline = stale
  if (!runnerOnline && gating.hasRunner) {
    const declaredInstalled = getCapabilityValue(capabilities, capabilityKey) === 'installed';
    return { 
      status: 'stale', 
      label: declaredInstalled ? 'État incertain' : 'À vérifier',
      staleReason: 'Runner hors ligne',
      runtimeVerification,
      lastVerifiedAt,
    };
  }
  
  // No runtime verification ever done
  if (!runtimeVerification && !lastVerifyOrder) {
    const declaredInstalled = getCapabilityValue(capabilities, capabilityKey) === 'installed';
    if (declaredInstalled) {
      // Has declared capability but no runtime proof
      return { 
        status: 'stale', 
        label: 'À vérifier',
        staleReason: 'État déclaré sans preuve runtime',
        lastVerifiedAt: null,
      };
    }
    return { 
      status: 'unknown', 
      label: 'Statut inconnu' 
    };
  }
  
  // Verification failed (order failed)
  if (lastVerifyOrder?.status === 'failed') {
    // Check if we can still parse a result
    if (runtimeVerification) {
      if (!runtimeVerification.installed) {
        return { 
          status: 'not_installed' as ServiceStatus, 
          label: 'Non installé',
          runtimeVerification,
          lastVerifiedAt,
        };
      }
      if (!runtimeVerification.running) {
        return { 
          status: 'stopped', 
          label: 'Arrêté',
          runtimeVerification,
          lastVerifiedAt,
        };
      }
    }
    return { 
      status: 'failed', 
      label: 'Échec vérification', 
      lastOrder: lastVerifyOrder 
    };
  }
  
  // Check verification age
  if (lastVerifiedAt) {
    const age = Date.now() - lastVerifiedAt.getTime();
    if (age > STALE_THRESHOLD_MS) {
      return { 
        status: 'stale', 
        label: 'Vérification périmée',
        staleReason: `Dernière vérification il y a ${Math.round(age / 60000)} min`,
        runtimeVerification,
        lastVerifiedAt,
      };
    }
  }
  
  // Runtime verified
  if (runtimeVerification) {
    if (!runtimeVerification.installed) {
      return { 
        status: 'ready_to_install', 
        label: 'Prêt à installer',
        runtimeVerification,
        lastVerifiedAt,
      };
    }
    if (!runtimeVerification.running) {
      return { 
        status: 'stopped', 
        label: 'Arrêté',
        runtimeVerification,
        lastVerifiedAt,
      };
    }
    // Installed and running = verified
    return { 
      status: 'installed', 
      label: runtimeVerification.https_ready ? 'Actif (HTTPS prêt)' : 'Actif',
      runtimeVerification,
      lastVerifiedAt,
    };
  }
  
  // Fallback: ready to install if never verified
  return { 
    status: 'unknown', 
    label: 'Statut inconnu' 
  };
}

// Compute status for other services (non-proxy)
function computeServiceStatus(
  service: typeof SERVICE_DEFINITIONS[0],
  capabilities: Record<string, unknown>,
  orders: Order[],
  baseGating: { hasInfra: boolean; hasRunner: boolean; runnerOnline: boolean; dockerInstalled: boolean; dockerComposeInstalled: boolean; allMet: boolean; missing: string[] }
): { status: ServiceStatus; label: string; lastOrder?: Order } {
  // If no infrastructure or runner, not configured
  if (!baseGating.hasInfra || !baseGating.hasRunner) {
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

  // Compute base gating (without proxy status yet)
  const baseGating = useMemo(() => {
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

  // Compute Caddy service with runtime verification
  const caddyService = useMemo(() => {
    const def = SERVICE_DEFINITIONS.find(s => s.id === 'caddy')!;
    const caddyStatus = computeProxyStatus('caddy', capabilities, orders, baseGating, associatedRunner?.last_seen_at);
    
    return {
      ...def,
      status: caddyStatus.status,
      statusLabel: caddyStatus.label,
      lastOrder: caddyStatus.lastOrder,
      runtimeVerification: caddyStatus.runtimeVerification,
      lastVerifiedAt: caddyStatus.lastVerifiedAt,
      staleReason: caddyStatus.staleReason,
      isVerifying: caddyStatus.isVerifying,
    };
  }, [capabilities, orders, baseGating, associatedRunner]);

  // Compute Nginx service with runtime verification
  const nginxService = useMemo(() => {
    const def = SERVICE_DEFINITIONS.find(s => s.id === 'nginx')!;
    const nginxStatus = computeProxyStatus('nginx', capabilities, orders, baseGating, associatedRunner?.last_seen_at);
    
    return {
      ...def,
      status: nginxStatus.status,
      statusLabel: nginxStatus.label,
      lastOrder: nginxStatus.lastOrder,
      runtimeVerification: nginxStatus.runtimeVerification,
      lastVerifiedAt: nginxStatus.lastVerifiedAt,
      staleReason: nginxStatus.staleReason,
      isVerifying: nginxStatus.isVerifying,
    };
  }, [capabilities, orders, baseGating, associatedRunner]);

  // Full gating including proxy status
  const gating: PlatformGating = useMemo(() => {
    const caddyVerified = caddyService.status === 'installed';
    const caddyHttpsReady = caddyService.runtimeVerification?.https_ready === true;
    const nginxVerified = nginxService.status === 'installed';
    const nginxHttpsReady = nginxService.runtimeVerification?.https_ready === true;
    const proxyReady = (caddyVerified && caddyHttpsReady) || (nginxVerified && nginxHttpsReady);
    
    return {
      ...baseGating,
      caddyVerified,
      caddyHttpsReady,
      nginxVerified,
      nginxHttpsReady,
      proxyReady,
    };
  }, [baseGating, caddyService, nginxService]);

  // Compute services with status
  const services: PlatformService[] = useMemo(() => {
    return SERVICE_DEFINITIONS.map(def => {
      if (def.id === 'caddy') return caddyService;
      if (def.id === 'nginx') return nginxService;
      
      const { status, label, lastOrder } = computeServiceStatus(def, capabilities, orders, baseGating);
      return {
        ...def,
        status,
        statusLabel: label,
        lastOrder,
      };
    });
  }, [caddyService, nginxService, capabilities, orders, baseGating]);

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
