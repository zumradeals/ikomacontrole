/**
 * RUNNER CAPABILITIES HOOK
 * 
 * Manages capabilities stored on the external API for each runner.
 * Capabilities track installed software (docker, node, git, etc.) 
 * and are used for playbook prerequisite checking.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { apiServerQueryKeys } from './useApiServers';

// Capability status values
export type CapabilityStatus = 'installed' | 'verified' | 'not_installed' | 'failed' | 'checking';

export interface RunnerCapabilities {
  // Core system
  'system.detected'?: CapabilityStatus;
  'system.updated'?: CapabilityStatus;
  
  // Essentials
  'curl.installed'?: CapabilityStatus;
  'wget.installed'?: CapabilityStatus;
  'git.installed'?: CapabilityStatus;
  'jq.installed'?: CapabilityStatus;
  
  // Docker
  'docker.detected'?: CapabilityStatus;
  'docker.installed'?: CapabilityStatus;
  'docker.verified'?: CapabilityStatus;
  'docker.compose.installed'?: CapabilityStatus;
  
  // Node.js
  'node.detected'?: CapabilityStatus;
  'node.installed'?: CapabilityStatus;
  'node.verified'?: CapabilityStatus;
  'npm.installed'?: CapabilityStatus;
  
  // Proxy
  'caddy.installed'?: CapabilityStatus;
  'caddy.verified'?: CapabilityStatus;
  'nginx.installed'?: CapabilityStatus;
  'nginx.verified'?: CapabilityStatus;
  
  // Services
  'redis.installed'?: CapabilityStatus;
  'prometheus.installed'?: CapabilityStatus;
  'supabase.installed'?: CapabilityStatus;
  'supabase.running'?: CapabilityStatus;
  
  // Allow any other capability
  [key: string]: CapabilityStatus | undefined;
}

interface UpdateCapabilitiesInput {
  runnerId: string;
  capabilities: Partial<RunnerCapabilities>;
  merge?: boolean; // If true, merge with existing; if false, replace
}

/**
 * Hook to update runner capabilities on the external API
 */
export function useUpdateRunnerCapabilities() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ runnerId, capabilities, merge = true }: UpdateCapabilitiesInput) => {
      const { data, error } = await supabase.functions.invoke('admin-proxy', {
        body: {
          method: 'PATCH',
          path: `/runners/${runnerId}/capabilities`,
          body: { capabilities, merge },
        },
      });

      if (error) {
        console.error('Error updating capabilities:', error);
        throw new Error(error.message || 'Failed to update capabilities');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      return data;
    },
    onSuccess: () => {
      // Invalidate runners cache to refetch with new capabilities
      queryClient.invalidateQueries({ queryKey: apiServerQueryKeys.runners });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur',
        description: `Impossible de mettre à jour les capacités: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Extract capabilities from a runner's data
 */
export function parseRunnerCapabilities(capabilities: unknown): RunnerCapabilities {
  if (!capabilities || typeof capabilities !== 'object') {
    return {};
  }
  return capabilities as RunnerCapabilities;
}

/**
 * Check if a specific capability is installed/verified
 */
export function hasCapability(
  capabilities: RunnerCapabilities | undefined,
  capabilityKey: string
): boolean {
  if (!capabilities) return false;
  const status = capabilities[capabilityKey];
  return status === 'installed' || status === 'verified';
}

/**
 * Check multiple capabilities at once
 */
export function checkCapabilities(
  capabilities: RunnerCapabilities | undefined,
  required: string[]
): { met: boolean; missing: string[] } {
  const missing: string[] = [];
  
  for (const key of required) {
    if (!hasCapability(capabilities, key)) {
      missing.push(key);
    }
  }
  
  return { met: missing.length === 0, missing };
}

/**
 * Get human-readable label for a capability
 */
export function getCapabilityLabel(key: string): string {
  const labels: Record<string, string> = {
    'docker.installed': 'Docker Engine',
    'docker.compose.installed': 'Docker Compose',
    'docker.verified': 'Docker (vérifié)',
    'node.installed': 'Node.js',
    'npm.installed': 'NPM',
    'git.installed': 'Git',
    'curl.installed': 'cURL',
    'wget.installed': 'wget',
    'jq.installed': 'jq',
    'caddy.installed': 'Caddy',
    'nginx.installed': 'Nginx',
    'redis.installed': 'Redis',
    'prometheus.installed': 'Prometheus',
    'supabase.installed': 'Supabase',
  };
  return labels[key] || key;
}
