/**
 * React Query hooks for server/runner operations via the Orders Admin Proxy.
 * 
 * These hooks ensure:
 * - All data comes from the external API (source of truth)
 * - Automatic refetch after mutations
 * - Proper error handling and toast notifications
 * - Optimistic updates disabled (wait for API confirmation)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import {
  listRunners,
  createRunner,
  resetRunnerToken,
  deleteRunner,
  attachRunnerToServer,
  detachRunnerFromServer,
  getProxyLogs,
  clearProxyLogs,
  type ProxyRunner,
  type CreateRunnerResult,
  type AttachResult,
  type ProxyLogEntry,
} from '@/lib/api/ordersAdminProxy';

// ============================================
// Query Keys
// ============================================

export const serverQueryKeys = {
  all: ['proxy-servers'] as const,
  runners: ['proxy-runners-v2'] as const,
  runner: (id: string) => ['proxy-runners-v2', id] as const,
  logs: ['proxy-logs'] as const,
};

// ============================================
// Runner Hooks
// ============================================

/**
 * Fetch all runners from the external API.
 * Auto-refreshes every 15 seconds to keep status up-to-date.
 */
export function useProxyRunnersV2() {
  return useQuery({
    queryKey: serverQueryKeys.runners,
    queryFn: async (): Promise<ProxyRunner[]> => {
      const result = await listRunners();
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch runners');
      }
      return result.data || [];
    },
    refetchInterval: 15000,
    staleTime: 10000,
  });
}
/**
 * @deprecated DO NOT USE - GET /runners/:id is not supported by the IKOMA Orders API.
 * Use useProxyRunnersV2() to get the list, then resolve locally with findRunnerInList().
 * 
 * This hook is kept for backward compatibility but will always return null
 * since the API returns 404 for individual runner fetches.
 */
export function useProxyRunnerV2(runnerId: string | null) {
  return useQuery({
    queryKey: serverQueryKeys.runner(runnerId || ''),
    queryFn: async (): Promise<ProxyRunner | null> => {
      // DO NOT call getRunner - it will return 404
      // Instead, return null and let callers use the list-based approach
      console.warn(`[useProxyRunnerV2] DEPRECATED: GET /runners/:id not supported. Use list-based resolution instead.`);
      return null;
    },
    enabled: false, // Disabled by default - force callers to use list approach
    staleTime: Infinity, // Never refetch
  });
}

/**
 * Find a runner by ID from a pre-fetched list.
 * This is the recommended way to resolve runner details - use with useProxyRunnersV2().
 * 
 * @example
 * const { data: runners } = useProxyRunnersV2();
 * const runner = findRunnerInList(runners, server.runnerId);
 */
export function findRunnerInList(
  runners: ProxyRunner[] | undefined, 
  runnerId: string | null | undefined
): ProxyRunner | null {
  if (!runners || !runnerId) return null;
  return runners.find(r => r.id === runnerId) || null;
}

/**
 * Create a new runner and optionally attach to infrastructure.
 */
export function useCreateRunnerV2() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      name, 
      infrastructureId 
    }: { 
      name: string; 
      infrastructureId?: string 
    }): Promise<CreateRunnerResult> => {
      const result = await createRunner(name, infrastructureId);
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to create runner');
      }
      return result.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: serverQueryKeys.runners });
      queryClient.invalidateQueries({ queryKey: ['proxy-runners'] });
      queryClient.invalidateQueries({ queryKey: ['infrastructures'] });
      toast({
        title: 'Agent créé',
        description: `${data.name} créé avec succès. Copiez le token maintenant !`,
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
 * Reset the token for a runner.
 */
export function useResetRunnerTokenV2() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (runnerId: string): Promise<{ token: string }> => {
      const result = await resetRunnerToken(runnerId);
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to reset token');
      }
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: serverQueryKeys.runners });
      queryClient.invalidateQueries({ queryKey: ['proxy-runners'] });
      toast({
        title: 'Token réinitialisé',
        description: 'Nouveau token généré. Copiez-le maintenant !',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Delete a runner from the API.
 */
export function useDeleteRunnerV2() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (runnerId: string): Promise<void> => {
      const result = await deleteRunner(runnerId);
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete runner');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: serverQueryKeys.runners });
      queryClient.invalidateQueries({ queryKey: ['proxy-runners'] });
      queryClient.invalidateQueries({ queryKey: ['infrastructures'] });
      toast({
        title: 'Agent supprimé',
        description: 'L\'agent a été supprimé.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// ============================================
// Attach/Detach Hooks
// ============================================

/**
 * Attach a runner to a server/infrastructure.
 * Uses fallback patterns for API compatibility.
 */
export function useAttachRunner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      serverId, 
      runnerId 
    }: { 
      serverId: string; 
      runnerId: string 
    }): Promise<AttachResult> => {
      const result = await attachRunnerToServer(serverId, runnerId);
      if (!result.success) {
        throw new Error(result.message || 'Failed to attach runner');
      }
      return result;
    },
    onSuccess: (result) => {
      // Invalidate all related queries to force refresh
      queryClient.invalidateQueries({ queryKey: serverQueryKeys.runners });
      queryClient.invalidateQueries({ queryKey: ['proxy-runners'] });
      queryClient.invalidateQueries({ queryKey: ['infrastructures'] });
      queryClient.invalidateQueries({ queryKey: ['runners'] });
      
      toast({
        title: 'Agent associé',
        description: result.message || 'L\'agent a été associé au serveur.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur d\'association',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Detach a runner from its server/infrastructure.
 */
export function useDetachRunner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      runnerId, 
      serverId 
    }: { 
      runnerId: string; 
      serverId?: string 
    }): Promise<AttachResult> => {
      const result = await detachRunnerFromServer(runnerId, serverId);
      if (!result.success) {
        throw new Error(result.message || 'Failed to detach runner');
      }
      return result;
    },
    onSuccess: (result) => {
      // Invalidate all related queries to force refresh
      queryClient.invalidateQueries({ queryKey: serverQueryKeys.runners });
      queryClient.invalidateQueries({ queryKey: ['proxy-runners'] });
      queryClient.invalidateQueries({ queryKey: ['infrastructures'] });
      queryClient.invalidateQueries({ queryKey: ['runners'] });
      
      toast({
        title: 'Agent dissocié',
        description: result.message || 'L\'agent a été dissocié du serveur.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur de dissociation',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// ============================================
// Create Runner and Attach in One Step
// ============================================

/**
 * Create a runner and automatically attach it to a server.
 */
export function useCreateAndAttachRunner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      name, 
      serverId 
    }: { 
      name: string; 
      serverId: string 
    }): Promise<{ runner: CreateRunnerResult; attached: boolean }> => {
      // Step 1: Create the runner
      const createResult = await createRunner(name, serverId);
      if (!createResult.success || !createResult.data) {
        throw new Error(createResult.error || 'Failed to create runner');
      }

      const runner = createResult.data;

      // Step 2: Verify attachment using list-based resolution (GET /runners/:id not supported)
      // Fetch all runners and find the one we just created
      const listResult = await listRunners();
      const createdRunner = listResult.success && listResult.data 
        ? listResult.data.find(r => r.id === runner.id)
        : null;
      
      const isAttached = createdRunner && 
        (createdRunner.infrastructureId === serverId || createdRunner.serverId === serverId);

      if (isAttached) {
        return { runner, attached: true };
      }

      // Step 3: Manually attach if not already attached
      const attachResult = await attachRunnerToServer(serverId, runner.id);
      
      return { 
        runner, 
        attached: attachResult.success 
      };
    },
    onSuccess: ({ runner, attached }) => {
      queryClient.invalidateQueries({ queryKey: serverQueryKeys.runners });
      queryClient.invalidateQueries({ queryKey: ['proxy-runners'] });
      queryClient.invalidateQueries({ queryKey: ['infrastructures'] });
      
      toast({
        title: 'Agent créé' + (attached ? ' et associé' : ''),
        description: attached 
          ? `${runner.name} créé et associé au serveur. Copiez le token !`
          : `${runner.name} créé. L'association a échoué, réessayez manuellement.`,
        variant: attached ? 'default' : 'destructive',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// ============================================
// Diagnostics Hook
// ============================================

/**
 * Access proxy logs for debugging.
 */
export function useProxyDiagnostics() {
  return {
    logs: getProxyLogs(),
    clearLogs: clearProxyLogs,
  };
}

/**
 * Verify runner association using list-based resolution.
 * GET /runners/:id is not supported by IKOMA API, so we use listRunners instead.
 */
export function useVerifyRunnerAssociation() {
  return useMutation({
    mutationFn: async ({ 
      runnerId, 
      expectedInfraId 
    }: { 
      runnerId: string; 
      expectedInfraId: string | null 
    }): Promise<{ 
      verified: boolean; 
      actualInfraId: string | null; 
      runner: ProxyRunner | null 
    }> => {
      // Use list-based resolution instead of GET /runners/:id
      const result = await listRunners();
      
      if (!result.success || !result.data) {
        return { verified: false, actualInfraId: null, runner: null };
      }

      const runner = result.data.find(r => r.id === runnerId);
      if (!runner) {
        return { verified: false, actualInfraId: null, runner: null };
      }

      const actualInfraId = runner.infrastructureId || runner.serverId || null;
      const verified = actualInfraId === expectedInfraId;

      return { verified, actualInfraId, runner };
    },
  });
}

// Re-export types for convenience
export type { ProxyRunner, CreateRunnerResult, AttachResult, ProxyLogEntry };
