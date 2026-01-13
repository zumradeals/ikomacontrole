import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ALL_PLAYBOOKS } from '@/lib/playbooks';

export interface InstalledCapability {
  id: string;
  name: string;
  group: string;
  installedAt: string;
  verifiedAt: string;
  status: 'active' | 'stale' | 'failed';
  version?: string;
  orderId: string;
}

export interface CapabilitySummary {
  total: number;
  active: number;
  stale: number;
  failed: number;
  byGroup: Record<string, InstalledCapability[]>;
}

// Map playbook IDs to friendly display names and icons
const CAPABILITY_DISPLAY: Record<string, { name: string; group: string }> = {};

// Build mapping from playbooks
ALL_PLAYBOOKS.forEach(pb => {
  pb.verifies.forEach(cap => {
    CAPABILITY_DISPLAY[cap] = { name: pb.name, group: pb.group };
  });
  // Also map by playbook ID
  CAPABILITY_DISPLAY[pb.id] = { name: pb.name, group: pb.group };
});

export function useInstalledCapabilities(infrastructureId?: string, runnerId?: string) {
  return useQuery({
    queryKey: ['installed-capabilities', infrastructureId, runnerId],
    queryFn: async () => {
      // Get all completed orders for this infrastructure/runner
      let query = supabase
        .from('orders')
        .select('*')
        .eq('status', 'completed')
        .order('completed_at', { ascending: false });

      if (infrastructureId) {
        query = query.eq('infrastructure_id', infrastructureId);
      } else if (runnerId) {
        query = query.eq('runner_id', runnerId);
      } else {
        return { capabilities: [], summary: getEmptySummary() };
      }

      const { data: orders, error } = await query;
      
      if (error) {
        console.error('Error fetching installed capabilities:', error);
        throw error;
      }

      // Track unique capabilities by playbook ID (most recent only)
      const capabilityMap = new Map<string, InstalledCapability>();
      const now = new Date();
      const staleThreshold = 24 * 60 * 60 * 1000; // 24 hours

      orders?.forEach(order => {
        // Extract playbook ID from order name or meta
        const playbookId = extractPlaybookId(order.name, order.meta as Record<string, unknown>);
        if (!playbookId) return;

        // Skip if we already have a more recent entry
        if (capabilityMap.has(playbookId)) return;

        const completedAt = order.completed_at ? new Date(order.completed_at) : now;
        const isStale = now.getTime() - completedAt.getTime() > staleThreshold;
        const exitCode = order.exit_code;
        
        const display = CAPABILITY_DISPLAY[playbookId] || { 
          name: order.name, 
          group: 'other' 
        };

        capabilityMap.set(playbookId, {
          id: playbookId,
          name: display.name,
          group: display.group,
          installedAt: order.completed_at || order.created_at,
          verifiedAt: order.completed_at || order.created_at,
          status: exitCode === 0 ? (isStale ? 'stale' : 'active') : 'failed',
          version: extractVersion(order.stdout_tail, order.result as Record<string, unknown>),
          orderId: order.id,
        });
      });

      const capabilities = Array.from(capabilityMap.values());
      const summary = buildSummary(capabilities);

      return { capabilities, summary };
    },
    enabled: !!(infrastructureId || runnerId),
    refetchInterval: 30000, // Refresh every 30s
  });
}

function extractPlaybookId(orderName: string, meta: Record<string, unknown> | null): string | null {
  // Try to get from meta first
  if (meta?.playbook_id) {
    return meta.playbook_id as string;
  }
  
  // Try to match order name to known playbooks
  const matchingPlaybook = ALL_PLAYBOOKS.find(pb => 
    pb.name.toLowerCase() === orderName.toLowerCase() ||
    pb.id.toLowerCase() === orderName.toLowerCase()
  );
  
  if (matchingPlaybook) {
    return matchingPlaybook.id;
  }

  // Try to extract from common patterns
  const patterns = [
    /^([\w.]+)\s*-/,  // "docker.install - Install Docker"
    /playbook[:\s]+(\S+)/i,
    /^Install\s+(\w+)/i,
    /^Installer\s+(\w+)/i,
    /^Vérifier\s+(\w+)/i,
    /^Configurer\s+(\w+)/i,
  ];

  for (const pattern of patterns) {
    const match = orderName.match(pattern);
    if (match) {
      return match[1].toLowerCase();
    }
  }

  return null;
}

function extractVersion(stdout: string | null, result: Record<string, unknown> | null): string | undefined {
  // Try to get from result JSON
  if (result?.version) {
    return String(result.version);
  }
  
  if (result?.capabilities && typeof result.capabilities === 'object') {
    const caps = result.capabilities as Record<string, unknown>;
    for (const value of Object.values(caps)) {
      if (typeof value === 'string' && value.match(/^\d+\.\d+/)) {
        return value;
      }
    }
  }

  // Try to extract from stdout
  if (stdout) {
    const versionMatch = stdout.match(/v?(\d+\.\d+(?:\.\d+)?)/);
    if (versionMatch) {
      return versionMatch[1];
    }
  }

  return undefined;
}

function getEmptySummary(): CapabilitySummary {
  return {
    total: 0,
    active: 0,
    stale: 0,
    failed: 0,
    byGroup: {},
  };
}

function buildSummary(capabilities: InstalledCapability[]): CapabilitySummary {
  const summary: CapabilitySummary = {
    total: capabilities.length,
    active: 0,
    stale: 0,
    failed: 0,
    byGroup: {},
  };

  capabilities.forEach(cap => {
    if (cap.status === 'active') summary.active++;
    else if (cap.status === 'stale') summary.stale++;
    else if (cap.status === 'failed') summary.failed++;

    if (!summary.byGroup[cap.group]) {
      summary.byGroup[cap.group] = [];
    }
    summary.byGroup[cap.group].push(cap);
  });

  return summary;
}

// Helper to get group display info
export const GROUP_DISPLAY: Record<string, { label: string; color: string }> = {
  system: { label: 'Système', color: 'bg-blue-500' },
  network: { label: 'Réseau', color: 'bg-purple-500' },
  runtime: { label: 'Runtime', color: 'bg-green-500' },
  docker: { label: 'Docker', color: 'bg-cyan-500' },
  proxy: { label: 'Proxy', color: 'bg-orange-500' },
  database: { label: 'Database', color: 'bg-red-500' },
  monitoring: { label: 'Monitoring', color: 'bg-yellow-500' },
  security: { label: 'Sécurité', color: 'bg-pink-500' },
  other: { label: 'Autre', color: 'bg-gray-500' },
};
