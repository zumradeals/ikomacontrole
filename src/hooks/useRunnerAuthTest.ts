import { useMutation } from '@tanstack/react-query';
import { useApiUrls } from './useApiUrls';

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
// Hooks - Direct runner endpoints (no admin key needed)
// ============================================

/**
 * Test runner authentication via heartbeat
 * Calls: POST /v1/runner/heartbeat
 * Uses headers: x-runner-id, x-runner-token
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
 * Calls: POST /v1/runner/orders/claim-next
 * Uses headers: x-runner-id, x-runner-token
 */
export function useTestClaimNext() {
  const { v1Url } = useApiUrls();

  return useMutation({
    mutationFn: async ({ runnerId, token }: { runnerId: string; token: string }): Promise<ClaimNextTestResult> => {
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
