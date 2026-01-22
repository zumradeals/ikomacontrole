/**
 * Playbook Admin Hooks
 * 
 * React Query hooks for playbook CRUD operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import {
  createPlaybook,
  listAdminPlaybooks,
  getPlaybook,
  updatePlaybook,
  deletePlaybook,
  scanScripts,
  type CreatePlaybookInput,
  type UpdatePlaybookInput,
  type PlaybookDefinition,
  type ScriptInfo,
} from '@/lib/api/playbooksAdminApi';

// ============================================
// Query Keys
// ============================================

export const playbookAdminKeys = {
  all: ['playbooks-admin'] as const,
  list: () => [...playbookAdminKeys.all, 'list'] as const,
  detail: (key: string) => [...playbookAdminKeys.all, 'detail', key] as const,
  scripts: (serverId: string) => [...playbookAdminKeys.all, 'scripts', serverId] as const,
};

// ============================================
// Queries
// ============================================

/**
 * List all playbooks with admin details
 */
export function useAdminPlaybooks() {
  return useQuery({
    queryKey: playbookAdminKeys.list(),
    queryFn: async () => {
      const result = await listAdminPlaybooks();
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch playbooks');
      }
      return result.data || [];
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Get single playbook detail
 */
export function usePlaybookDetail(key: string | undefined) {
  return useQuery({
    queryKey: playbookAdminKeys.detail(key || ''),
    queryFn: async () => {
      if (!key) throw new Error('Playbook key required');
      const result = await getPlaybook(key);
      if (!result.success) {
        throw new Error(result.error || 'Playbook not found');
      }
      return result.data;
    },
    enabled: !!key,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Scan server for available scripts
 */
export function useScriptScan(serverId: string | undefined) {
  return useQuery({
    queryKey: playbookAdminKeys.scripts(serverId || ''),
    queryFn: async () => {
      if (!serverId) throw new Error('Server ID required');
      const result = await scanScripts(serverId);
      if (!result.success) {
        throw new Error(result.error || 'Failed to scan scripts');
      }
      return result.data || [];
    },
    enabled: false, // Manual trigger only
    staleTime: 30 * 1000, // 30 seconds
  });
}

// ============================================
// Mutations
// ============================================

/**
 * Create a new playbook
 */
export function useCreatePlaybook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreatePlaybookInput) => {
      const result = await createPlaybook(input);
      if (!result.success) {
        throw new Error(result.error || 'Failed to create playbook');
      }
      return result.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: playbookAdminKeys.list() });
      queryClient.invalidateQueries({ queryKey: ['playbooks'] }); // Invalidate public list too
      toast({
        title: 'Playbook créé',
        description: `${data?.title} a été créé avec succès`,
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
 * Update a playbook
 */
export function useUpdatePlaybook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ key, input }: { key: string; input: UpdatePlaybookInput }) => {
      const result = await updatePlaybook(key, input);
      if (!result.success) {
        throw new Error(result.error || 'Failed to update playbook');
      }
      return result.data;
    },
    onSuccess: (data, { key }) => {
      queryClient.invalidateQueries({ queryKey: playbookAdminKeys.list() });
      queryClient.invalidateQueries({ queryKey: playbookAdminKeys.detail(key) });
      queryClient.invalidateQueries({ queryKey: ['playbooks'] });
      toast({
        title: 'Playbook mis à jour',
        description: `${data?.title} a été modifié`,
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
 * Delete a playbook
 */
export function useDeletePlaybook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (key: string) => {
      const result = await deletePlaybook(key);
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete playbook');
      }
    },
    onSuccess: (_, key) => {
      queryClient.invalidateQueries({ queryKey: playbookAdminKeys.list() });
      queryClient.invalidateQueries({ queryKey: playbookAdminKeys.detail(key) });
      queryClient.invalidateQueries({ queryKey: ['playbooks'] });
      toast({
        title: 'Playbook supprimé',
        description: 'Le playbook a été supprimé',
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
 * Trigger script scan
 */
export function useTriggerScriptScan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (serverId: string) => {
      const result = await scanScripts(serverId);
      if (!result.success) {
        throw new Error(result.error || 'Failed to scan scripts');
      }
      return result.data || [];
    },
    onSuccess: (data, serverId) => {
      queryClient.setQueryData(playbookAdminKeys.scripts(serverId), data);
      toast({
        title: 'Scan terminé',
        description: `${data.length} scripts trouvés`,
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

// Re-export types
export type { PlaybookDefinition, CreatePlaybookInput, UpdatePlaybookInput, ScriptInfo };
