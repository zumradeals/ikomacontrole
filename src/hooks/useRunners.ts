/**
 * PROXY-ONLY RUNNERS HOOK
 * 
 * This hook provides runner data via the secure admin-proxy Edge Function.
 * IMPORTANT: Direct Supabase access to the 'runners' table is FORBIDDEN.
 * All data comes from the external Orders API (source of truth).
 * 
 * Migration note: This file was refactored to eliminate direct Supabase calls.
 * If you see any supabase.from('runners') in this file, it's a bug.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { 
  listRunners, 
  deleteRunner as apiDeleteRunner,
  type ProxyRunner 
} from '@/lib/api/ordersAdminProxy';

// Legacy interface for backward compatibility
export interface Runner {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'paused' | 'unknown';
  capabilities: Record<string, unknown>;
  host_info: Record<string, unknown> | null;
  infrastructure_id: string | null;
  last_seen_at: string | null;
  created_at: string;
}

// Status threshold for computing effective status
const OFFLINE_THRESHOLD_MS = 60 * 1000;

/**
 * Convert ProxyRunner (from API) to legacy Runner format for backward compatibility
 */
function mapProxyRunnerToLegacy(runner: ProxyRunner): Runner {
  // Compute effective status based on lastHeartbeatAt
  let status: Runner['status'] = 'unknown';
  if (runner.status?.toLowerCase() === 'paused') {
    status = 'paused';
  } else if (runner.lastHeartbeatAt) {
    const lastSeen = new Date(runner.lastHeartbeatAt).getTime();
    const now = Date.now();
    status = now - lastSeen > OFFLINE_THRESHOLD_MS ? 'offline' : 'online';
  }

  return {
    id: runner.id,
    name: runner.name,
    status,
    capabilities: runner.capabilities || {},
    host_info: runner.hostInfo || null,
    infrastructure_id: runner.infrastructureId || null,
    last_seen_at: runner.lastHeartbeatAt || null,
    created_at: runner.createdAt,
  };
}

/**
 * Fetch runners from the external Orders API via admin-proxy.
 * This is the ONLY authorized way to get runner data in this application.
 * 
 * @returns Query result with Runner[] (legacy format for compatibility)
 */
export function useRunners() {
  return useQuery({
    queryKey: ['runners'],
    queryFn: async (): Promise<Runner[]> => {
      console.log('[useRunners] Fetching via admin-proxy...');
      
      const result = await listRunners();
      
      if (!result.success) {
        console.error('[useRunners] API Error:', result.error);
        throw new Error(result.error || 'Failed to fetch runners');
      }

      const runners = (result.data || []).map(mapProxyRunnerToLegacy);
      console.log(`[useRunners] Loaded ${runners.length} runners from API`);
      return runners;
    },
    refetchInterval: 15000, // Refetch every 15 seconds
    staleTime: 10000,
  });
}

/**
 * Delete a runner via the external Orders API.
 */
export function useDeleteRunner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (runnerId: string): Promise<void> => {
      console.log('[useDeleteRunner] Deleting via admin-proxy:', runnerId);
      
      const result = await apiDeleteRunner(runnerId);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete runner');
      }
    },
    onSuccess: () => {
      // Invalidate all runner-related queries
      queryClient.invalidateQueries({ queryKey: ['runners'] });
      queryClient.invalidateQueries({ queryKey: ['proxy-runners'] });
      queryClient.invalidateQueries({ queryKey: ['proxy-runners-v2'] });
      queryClient.invalidateQueries({ queryKey: ['infrastructures'] });
      
      toast({
        title: 'Runner supprimé',
        description: 'Le runner a été supprimé avec succès.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur',
        description: `Impossible de supprimer le runner: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
}

// Re-export ProxyRunner for components that need the raw API type
export type { ProxyRunner };
