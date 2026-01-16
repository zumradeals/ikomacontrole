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
// Edge Function URL helper
// ============================================

const getProxyUrl = () => {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'lqocccsxzqnbcwshseom';
  return `https://${projectId}.supabase.co/functions/v1/admin-proxy`;
};

// ============================================
// Hooks
// ============================================

/**
 * Fetch runners via the secure backend proxy
 * Calls: GET /admin-proxy/runners
 */
export function useProxyRunners() {
  return useQuery({
    queryKey: ['proxy-runners'],
    queryFn: async (): Promise<ProxyRunner[]> => {
      const url = `${getProxyUrl()}/runners`;
      console.log('FETCH_RUNNERS_REQUEST', url);
      
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token && { 'Authorization': `Bearer ${session.access_token}` }),
        },
      });

      console.log('FETCH_RUNNERS_RESPONSE', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('FETCH_RUNNERS_ERROR', errorData);
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log('FETCH_RUNNERS_SUCCESS', { count: data.runners?.length ?? 0 });
      return data.runners || [];
    },
    refetchInterval: 15000,
    staleTime: 10000,
  });
}

/**
 * Create a new runner via the secure backend proxy
 * Calls: POST /admin-proxy/runners
 * Returns the runner ID and initial clear token
 */
export function useProxyCreateRunner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, infrastructureId }: { name: string; infrastructureId?: string }): Promise<CreateRunnerResult> => {
      console.log('CREATE_RUNNER_REQUEST', { name, infrastructureId });
      
      const { data: { session } } = await supabase.auth.getSession();
      const url = `${getProxyUrl()}/runners`;
      
      console.log('CREATE_RUNNER_URL', url);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token && { 'Authorization': `Bearer ${session.access_token}` }),
        },
        body: JSON.stringify({
          name,
          infrastructureId: infrastructureId || null,
        }),
      });

      console.log('CREATE_RUNNER_RESPONSE', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('CREATE_RUNNER_ERROR', errorData);
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
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
 * Calls: POST /admin-proxy/runners/:id/token/reset
 */
export function useProxyResetToken() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (runnerId: string): Promise<ResetTokenResult> => {
      console.log('TOKEN_RESET_REQUEST', runnerId);
      
      const { data: { session } } = await supabase.auth.getSession();
      const url = `${getProxyUrl()}/runners/${runnerId}/token/reset`;
      
      console.log('TOKEN_RESET_URL', url);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token && { 'Authorization': `Bearer ${session.access_token}` }),
        },
        body: JSON.stringify({}), // Required: non-empty body for Fastify
      });

      console.log('TOKEN_RESET_RESPONSE', response.status);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Endpoint token/reset non implémenté côté serveur');
        }
        const errorData = await response.json().catch(() => ({}));
        console.error('TOKEN_RESET_ERROR', errorData);
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
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
