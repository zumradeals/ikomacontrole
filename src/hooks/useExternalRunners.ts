import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiUrls } from './useApiUrls';
import { toast } from '@/hooks/use-toast';

interface ExternalRunner {
  id: string;
  name: string;
  status: string;
  last_seen_at: string | null;
  infrastructure_id: string | null;
  host_info?: {
    hostname?: string;
    os?: string;
    arch?: string;
  };
  created_at: string;
}

/**
 * Fetch runners from the external Orders API (source of truth)
 * Uses GET /v1/runners with x-ikoma-admin-key header
 */
export function useExternalRunners() {
  const { v1Url, isLoading: urlsLoading } = useApiUrls();

  return useQuery({
    queryKey: ['external-runners', v1Url],
    queryFn: async (): Promise<ExternalRunner[]> => {
      // Get the admin key from environment (edge function will have it)
      // For frontend, we need to call via our edge function or have it configured
      const adminKey = import.meta.env.VITE_IKOMA_ADMIN_KEY;
      
      if (!adminKey) {
        // If no admin key in env, the API call will fail
        // We'll handle this gracefully
        console.warn('VITE_IKOMA_ADMIN_KEY not configured');
      }

      const response = await fetch(`${v1Url}/runners`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(adminKey && { 'x-ikoma-admin-key': adminKey }),
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      return data.runners || data || [];
    },
    enabled: !urlsLoading && !!v1Url,
    refetchInterval: 15000, // Refetch every 15 seconds
    staleTime: 10000,
  });
}

interface ResetTokenResult {
  token: string;
}

/**
 * Reset token for a runner via backend API
 * Uses POST /v1/runners/:id/token/reset with x-ikoma-admin-key header
 */
export function useResetRunnerToken() {
  const { v1Url } = useApiUrls();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (runnerId: string): Promise<ResetTokenResult> => {
      const adminKey = import.meta.env.VITE_IKOMA_ADMIN_KEY;
      
      if (!adminKey) {
        throw new Error('Clé admin non configurée (VITE_IKOMA_ADMIN_KEY)');
      }

      const response = await fetch(`${v1Url}/runners/${runnerId}/token/reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ikoma-admin-key': adminKey,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Endpoint token/reset non implémenté côté serveur');
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['external-runners'] });
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

interface HeartbeatTestResult {
  success: boolean;
  message: string;
  status: number;
}

/**
 * Test runner authentication via heartbeat
 * Uses POST /v1/runner/heartbeat with x-runner-id and x-runner-token headers
 */
export function useTestRunnerAuth() {
  const { v1Url } = useApiUrls();

  return useMutation({
    mutationFn: async ({ runnerId, token }: { runnerId: string; token: string }): Promise<HeartbeatTestResult> => {
      const response = await fetch(`${v1Url}/runner/heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-runner-id': runnerId,
          'x-runner-token': token,
        },
        body: JSON.stringify({}),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.ok === true) {
        return {
          success: true,
          message: 'Authentification réussie',
          status: response.status,
        };
      }

      return {
        success: false,
        message: data.message || data.error || `HTTP ${response.status}`,
        status: response.status,
      };
    },
  });
}

/**
 * Test claim-next endpoint
 * Uses POST /v1/runner/orders/claim-next with runner headers
 */
export function useTestClaimNext() {
  const { v1Url } = useApiUrls();

  return useMutation({
    mutationFn: async ({ runnerId, token }: { runnerId: string; token: string }): Promise<{
      success: boolean;
      hasOrder: boolean;
      message: string;
      status: number;
    }> => {
      const response = await fetch(`${v1Url}/runner/orders/claim-next`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-runner-id': runnerId,
          'x-runner-token': token,
        },
        body: JSON.stringify({}),
      });

      if (response.status === 204) {
        return {
          success: true,
          hasOrder: false,
          message: 'Aucun ordre en attente',
          status: 204,
        };
      }

      if (response.ok) {
        return {
          success: true,
          hasOrder: true,
          message: 'Ordre récupéré',
          status: response.status,
        };
      }

      const data = await response.json().catch(() => ({}));
      return {
        success: false,
        hasOrder: false,
        message: data.message || data.error || `HTTP ${response.status}`,
        status: response.status,
      };
    },
  });
}
