import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

// ============================================
// Types
// ============================================

export interface ProxyRunner {
  id: string;
  name: string;
  status: string;
  lastHeartbeatAt: string | null;
  infrastructureId: string | null;
  scopes?: string[];
  capabilities?: Record<string, unknown>;
  hostInfo?: {
    hostname?: string;
    os?: string;
    arch?: string;
  };
  createdAt: string;
}

interface CreateRunnerResult {
  id: string;
  name: string;
  token: string; // Clear token returned only on creation
}

interface ResetTokenResult {
  token: string;
}

// ============================================
// Hooks using supabase.functions.invoke
// ============================================

/**
 * Fetch runners via the secure backend proxy
 * Calls: admin-proxy -> GET /v1/runners
 */
export function useProxyRunners() {
  return useQuery({
    queryKey: ['proxy-runners'],
    queryFn: async (): Promise<ProxyRunner[]> => {
      console.log('FETCH_RUNNERS_REQUEST via admin-proxy');
      
      const { data, error } = await supabase.functions.invoke('admin-proxy', {
        body: {
          method: 'GET',
          path: '/runners',
        },
      });

      console.log('FETCH_RUNNERS_RESPONSE', { data, error });

      if (error) {
        console.error('FETCH_RUNNERS_ERROR', error);
        throw new Error(error.message || 'Failed to fetch runners');
      }

      // Handle API error response
      if (data?.error) {
        console.error('FETCH_RUNNERS_API_ERROR', data.error);
        throw new Error(data.error);
      }

      const runners = data?.runners || data || [];
      console.log('FETCH_RUNNERS_SUCCESS', { count: Array.isArray(runners) ? runners.length : 0 });
      return Array.isArray(runners) ? runners : [];
    },
    refetchInterval: 15000,
    staleTime: 10000,
  });
}

/**
 * Create a new runner via the secure backend proxy
 * Calls: admin-proxy -> POST /v1/runners
 * Returns the runner ID and initial clear token
 */
export function useProxyCreateRunner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, infrastructureId }: { name: string; infrastructureId?: string }): Promise<CreateRunnerResult> => {
      console.log('CREATE_RUNNER_REQUEST', { name, infrastructureId });
      
      const { data, error } = await supabase.functions.invoke('admin-proxy', {
        body: {
          method: 'POST',
          path: '/runners',
          body: {
            name,
            infrastructureId: infrastructureId || null,
          },
        },
      });

      console.log('CREATE_RUNNER_RESPONSE', { data, error });

      if (error) {
        console.error('CREATE_RUNNER_ERROR', error);
        throw new Error(error.message || 'Failed to create runner');
      }

      if (data?.error) {
        console.error('CREATE_RUNNER_API_ERROR', data.error);
        throw new Error(data.error);
      }

      console.log('CREATE_RUNNER_SUCCESS', { id: data.id, name: data.name, hasToken: !!data.token });
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['proxy-runners'] });
      queryClient.invalidateQueries({ queryKey: ['runners'] });
      toast({
        title: 'Runner créé',
        description: `${data.name} créé avec succès. Token généré !`,
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
 * Reset token for a runner via the secure backend proxy
 * Calls: admin-proxy -> POST /v1/runners/:id/token/reset
 */
export function useProxyResetToken() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (runnerId: string): Promise<ResetTokenResult> => {
      console.log('TOKEN_RESET_REQUEST', runnerId);
      
      const { data, error } = await supabase.functions.invoke('admin-proxy', {
        body: {
          method: 'POST',
          path: `/runners/${runnerId}/token/reset`,
          body: {}, // Empty body required by Fastify
        },
      });

      console.log('TOKEN_RESET_RESPONSE', { data, error });

      if (error) {
        console.error('TOKEN_RESET_ERROR', error);
        throw new Error(error.message || 'Failed to reset token');
      }

      if (data?.error) {
        console.error('TOKEN_RESET_API_ERROR', data.error);
        throw new Error(data.error);
      }

      console.log('TOKEN_RESET_SUCCESS', { hasToken: !!data.token });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proxy-runners'] });
      toast({
        title: 'Token réinitialisé',
        description: 'Le nouveau token a été généré. Copiez-le maintenant !',
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
