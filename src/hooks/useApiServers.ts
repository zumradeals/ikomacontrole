/**
 * API-first hooks for Server management via Orders API through admin-proxy.
 * 
 * Source of truth: Orders API (GET/POST/PATCH/DELETE /servers)
 * Association: servers.runnerId
 * Zero direct Supabase access for servers/runners.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import {
  listServers,
  createServer,
  updateServerRunner,
  deleteServer,
  listRunners,
  type ProxyServer,
  type ProxyRunner,
} from '@/lib/api/ordersAdminProxy';

// ============================================
// Query Keys
// ============================================

export const apiServerQueryKeys = {
  servers: ['api-servers'] as const,
  server: (id: string) => ['api-servers', id] as const,
  runners: ['api-runners'] as const,
};

// ============================================
// Server Hooks
// ============================================

/**
 * Fetch all servers from the Orders API.
 * Auto-refreshes every 15 seconds.
 */
export function useApiServers() {
  return useQuery({
    queryKey: apiServerQueryKeys.servers,
    queryFn: async (): Promise<ProxyServer[]> => {
      const result = await listServers();
      if (!result.success) {
        console.warn('[useApiServers] API /servers not available:', result.error);
        return [];
      }
      return result.data || [];
    },
    refetchInterval: 15000,
    staleTime: 10000,
  });
}

/**
 * Fetch all runners from the Orders API.
 * Used for the runner selection dropdown.
 */
export function useApiRunners() {
  return useQuery({
    queryKey: apiServerQueryKeys.runners,
    queryFn: async (): Promise<ProxyRunner[]> => {
      const result = await listRunners();
      if (!result.success) {
        console.warn('[useApiRunners] API /runners not available:', result.error);
        return [];
      }
      return result.data || [];
    },
    refetchInterval: 15000,
    staleTime: 10000,
  });
}

// ============================================
// Enriched Server Hook (resolves runner info locally)
// ============================================

export interface EnrichedServer extends ProxyServer {
  runnerName: string | null;
  runnerStatus: string | null;
}

/**
 * Fetch servers and enrich them with runner info from the runners list.
 * This avoids calling GET /runners/:id (not supported).
 */
export function useEnrichedServers() {
  const serversQuery = useApiServers();
  const runnersQuery = useApiRunners();

  // Build a map for O(1) runner lookup
  const runnersById = new Map<string, ProxyRunner>();
  if (runnersQuery.data) {
    runnersQuery.data.forEach(r => runnersById.set(r.id, r));
  }

  // Enrich servers with runner info
  const enrichedServers: EnrichedServer[] = (serversQuery.data || []).map(server => {
    const runner = server.runnerId ? runnersById.get(server.runnerId) : null;
    return {
      ...server,
      runnerName: runner?.name ?? null,
      runnerStatus: runner?.status ?? null,
    };
  });

  return {
    data: enrichedServers,
    servers: serversQuery.data || [],
    runners: runnersQuery.data || [],
    runnersById,
    isLoading: serversQuery.isLoading || runnersQuery.isLoading,
    isError: serversQuery.isError || runnersQuery.isError,
    error: serversQuery.error || runnersQuery.error,
    refetch: () => {
      serversQuery.refetch();
      runnersQuery.refetch();
    },
  };
}

/**
 * Create a new server via POST /servers.
 */
export function useApiCreateServer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      name, 
      baseUrl,
      runnerId 
    }: { 
      name: string; 
      baseUrl?: string;
      runnerId?: string | null;
    }): Promise<ProxyServer> => {
      const result = await createServer(name, baseUrl, runnerId);
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to create server');
      }
      return result.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: apiServerQueryKeys.servers });
      queryClient.invalidateQueries({ queryKey: apiServerQueryKeys.runners });
      toast({
        title: 'Serveur créé',
        description: `${data.name} créé avec succès.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur création',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Update server-runner association via PATCH /servers/:id.
 * Body: { runnerId: "<id>" | null }
 */
export function useApiUpdateServerRunner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      serverId, 
      runnerId 
    }: { 
      serverId: string; 
      runnerId: string | null;
    }): Promise<void> => {
      const result = await updateServerRunner(serverId, runnerId);
      if (!result.success) {
        throw new Error(result.error || 'Failed to update server runner');
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: apiServerQueryKeys.servers });
      queryClient.invalidateQueries({ queryKey: apiServerQueryKeys.runners });
      toast({
        title: variables.runnerId ? 'Runner associé' : 'Runner dissocié',
        description: variables.runnerId 
          ? 'Le runner a été associé au serveur.'
          : 'Le runner a été dissocié du serveur.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur association',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Delete a server via DELETE /servers/:id.
 */
export function useApiDeleteServer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (serverId: string): Promise<void> => {
      const result = await deleteServer(serverId);
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete server');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiServerQueryKeys.servers });
      queryClient.invalidateQueries({ queryKey: apiServerQueryKeys.runners });
      toast({
        title: 'Serveur supprimé',
        description: 'Le serveur a été supprimé.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur suppression',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Re-export types
export type { ProxyServer, ProxyRunner };
