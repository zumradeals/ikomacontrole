import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ============================================
// Types
// ============================================

interface HeartbeatTestResult {
  success: boolean;
  message: string;
  status: number;
}

interface ClaimNextTestResult {
  success: boolean;
  hasOrder: boolean;
  message: string;
  status: number;
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

      const { data, error } = await supabase.functions.invoke('runner-proxy', {
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
        error: error?.message,
        data 
      });

      if (error) {
        return {
          success: false,
          message: error.message || 'Erreur de connexion au proxy',
          status: 500,
        };
      }

      // Check if the backend returned success
      if (data?.ok === true) {
        return {
          success: true,
          message: 'Authentification réussie',
          status: 200,
        };
      }

      // Handle error responses from the backend
      return {
        success: false,
        message: data?.message || data?.error || 'Erreur d\'authentification',
        status: data?.status || 401,
      };
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

      const { data, error } = await supabase.functions.invoke('runner-proxy', {
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
        error: error?.message,
        data 
      });

      if (error) {
        // Check if it's a 204 (no content) which means no orders available
        if (error.message?.includes('204')) {
          return {
            success: true,
            hasOrder: false,
            message: 'Aucun ordre en attente',
            status: 204,
          };
        }
        return {
          success: false,
          hasOrder: false,
          message: error.message || 'Erreur de connexion au proxy',
          status: 500,
        };
      }

      // Empty response or null data means 204 No Content
      if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
        return {
          success: true,
          hasOrder: false,
          message: 'Aucun ordre en attente',
          status: 204,
        };
      }

      // If we got data, there's an order
      return {
        success: true,
        hasOrder: true,
        message: 'Ordre récupéré',
        status: 200,
      };
    },
  });
}
