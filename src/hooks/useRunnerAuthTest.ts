import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ============================================
// Types
// ============================================

interface HeartbeatTestResult {
  success: boolean;
  message: string;
  status: number;
  errorType?: 'network' | 'auth' | 'server' | 'proxy';
}

interface ClaimNextTestResult {
  success: boolean;
  hasOrder: boolean;
  message: string;
  status: number;
  errorType?: 'network' | 'auth' | 'server' | 'proxy';
}

// ============================================
// Hooks - Via runner-proxy Edge Function (no direct browser calls)
// ============================================

/**
 * Test runner authentication via heartbeat
 * Uses: runner-proxy Edge Function → POST /v1/runner/heartbeat
 */
export function useTestRunnerAuth() {
  return useMutation({
    mutationFn: async ({ runnerId, token }: { runnerId: string; token: string }): Promise<HeartbeatTestResult> => {
      console.log('RUNNER_AUTH_TEST_REQUEST', { runnerId: runnerId.slice(0, 8) + '...' });

      try {
        const { data, error, status } = await supabase.functions.invoke('runner-proxy', {
          body: {
            method: 'POST',
            path: '/runner/heartbeat',
            runnerId,
            runnerToken: token,
            body: {},
          },
        });

        console.log('RUNNER_AUTH_TEST_RESPONSE', { 
          status: error ? 'error' : 'success', 
          httpStatus: status,
          error: error?.message,
          data 
        });

        // 1. Handle Supabase/Network errors (Failed to fetch the function itself)
        if (error) {
          return {
            success: false,
            message: `Proxy unreachable / CORS / DNS: ${error.message}`,
            status: status || 500,
            errorType: 'network',
          };
        }

        // 2. Handle specific proxy errors (502 from our proxy means backend is down)
        if (status === 502) {
          return {
            success: false,
            message: data?.message || 'API backend down or unreachable',
            status: 502,
            errorType: 'server',
          };
        }

        // 3. Handle Auth errors (401/403)
        if (status === 401 || status === 403) {
          return {
            success: false,
            message: 'Token invalide ou expiré',
            status,
            errorType: 'auth',
          };
        }

        // 4. Handle other server errors (5xx)
        if (status >= 500) {
          return {
            success: false,
            message: data?.message || data?.error || 'Erreur serveur API',
            status,
            errorType: 'server',
          };
        }

        // 5. Success (200 OK)
        if (status >= 200 && status < 300) {
          return {
            success: true,
            message: 'Authentification réussie',
            status,
          };
        }

        // Fallback
        return {
          success: false,
          message: data?.message || data?.error || `Erreur inconnue (HTTP ${status})`,
          status: status || 500,
        };
      } catch (e) {
        return {
          success: false,
          message: e instanceof Error ? e.message : 'Erreur réseau critique',
          status: 500,
          errorType: 'network',
        };
      }
    },
  });
}

/**
 * Test claim-next endpoint
 * Uses: runner-proxy Edge Function → POST /v1/runner/orders/claim-next
 */
export function useTestClaimNext() {
  return useMutation({
    mutationFn: async ({ runnerId, token }: { runnerId: string; token: string }): Promise<ClaimNextTestResult> => {
      console.log('RUNNER_CLAIM_NEXT_REQUEST', { runnerId: runnerId.slice(0, 8) + '...' });

      try {
        const { data, error, status } = await supabase.functions.invoke('runner-proxy', {
          body: {
            method: 'POST',
            path: '/runner/orders/claim-next',
            runnerId,
            runnerToken: token,
            body: {},
          },
        });

        console.log('RUNNER_CLAIM_NEXT_RESPONSE', { 
          status: error ? 'error' : 'success', 
          httpStatus: status,
          error: error?.message,
          data 
        });

        if (error) {
          return {
            success: false,
            hasOrder: false,
            message: `Proxy unreachable: ${error.message}`,
            status: status || 500,
            errorType: 'network',
          };
        }

        // Handle 204 No Content
        if (status === 204 || (!data && status === 200)) {
          return {
            success: true,
            hasOrder: false,
            message: 'Aucun ordre en attente',
            status: 204,
          };
        }

        if (status === 401 || status === 403) {
          return {
            success: false,
            hasOrder: false,
            message: 'Token invalide',
            status,
            errorType: 'auth',
          };
        }

        if (status >= 400) {
          return {
            success: false,
            hasOrder: false,
            message: data?.message || data?.error || `Erreur API (HTTP ${status})`,
            status,
            errorType: status >= 500 ? 'server' : 'auth',
          };
        }

        return {
          success: true,
          hasOrder: true,
          message: 'Ordre récupéré',
          status: 200,
        };
      } catch (e) {
        return {
          success: false,
          hasOrder: false,
          message: e instanceof Error ? e.message : 'Erreur réseau critique',
          status: 500,
          errorType: 'network',
        };
      }
    },
  });
}
