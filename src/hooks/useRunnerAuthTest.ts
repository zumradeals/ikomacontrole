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
        const { data, error } = await supabase.functions.invoke('runner-proxy', {
          body: {
            method: 'POST',
            path: '/runner/heartbeat',
            runnerId,
            runnerToken: token,
            body: {},
          },
        });

        // Extract status from error context or default based on error presence
        // The edge function returns JSON with the status embedded in the response
        const httpStatus = error?.context?.status ?? (error ? 500 : 200);

        console.log('RUNNER_AUTH_TEST_RESPONSE', { 
          status: error ? 'error' : 'success', 
          httpStatus,
          error: error?.message,
          data 
        });

        // 1. Handle Supabase/Network errors (Failed to fetch the function itself)
        if (error) {
          // Check if it's a relay error with status in message
          const statusMatch = error.message?.match(/Edge Function returned a non-2xx status code: (\d+)/);
          const extractedStatus = statusMatch ? parseInt(statusMatch[1], 10) : httpStatus;
          
          if (extractedStatus === 401 || extractedStatus === 403) {
            return {
              success: false,
              message: 'Token invalide ou expiré',
              status: extractedStatus,
              errorType: 'auth',
            };
          }
          
          if (extractedStatus === 502) {
            return {
              success: false,
              message: data?.message || 'API backend down or unreachable',
              status: 502,
              errorType: 'server',
            };
          }
          
          return {
            success: false,
            message: `Proxy error: ${error.message}`,
            status: extractedStatus,
            errorType: 'network',
          };
        }

        // 2. Check for error in data payload (our proxy returns errors in body)
        if (data?.error) {
          const status = data.status || 500;
          if (status === 401 || status === 403) {
            return {
              success: false,
              message: 'Token invalide ou expiré',
              status,
              errorType: 'auth',
            };
          }
          return {
            success: false,
            message: data.message || data.error || 'Erreur serveur API',
            status,
            errorType: status >= 500 ? 'server' : 'proxy',
          };
        }

        // 3. Success
        return {
          success: true,
          message: 'Authentification réussie',
          status: 200,
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
        const { data, error } = await supabase.functions.invoke('runner-proxy', {
          body: {
            method: 'POST',
            path: '/runner/orders/claim-next',
            runnerId,
            runnerToken: token,
            body: {},
          },
        });

        const httpStatus = error?.context?.status ?? (error ? 500 : 200);

        console.log('RUNNER_CLAIM_NEXT_RESPONSE', { 
          status: error ? 'error' : 'success', 
          httpStatus,
          error: error?.message,
          data 
        });

        if (error) {
          const statusMatch = error.message?.match(/Edge Function returned a non-2xx status code: (\d+)/);
          const extractedStatus = statusMatch ? parseInt(statusMatch[1], 10) : httpStatus;
          
          if (extractedStatus === 401 || extractedStatus === 403) {
            return {
              success: false,
              hasOrder: false,
              message: 'Token invalide',
              status: extractedStatus,
              errorType: 'auth',
            };
          }
          
          return {
            success: false,
            hasOrder: false,
            message: `Proxy error: ${error.message}`,
            status: extractedStatus,
            errorType: 'network',
          };
        }

        // Handle empty data (204 No Content equivalent)
        if (!data || data === null) {
          return {
            success: true,
            hasOrder: false,
            message: 'Aucun ordre en attente',
            status: 204,
          };
        }

        // Check for error in data payload
        if (data?.error) {
          const status = data.status || 500;
          return {
            success: false,
            hasOrder: false,
            message: data.message || data.error || `Erreur API`,
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
