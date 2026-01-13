import { useMemo, useCallback } from 'react';
import { useCreateOrder, Order } from './useOrders';
import { getNginxPlaybookById } from '@/lib/nginx-playbooks';
import { toast } from '@/hooks/use-toast';

// Runtime verification result for Nginx
export interface NginxRuntimeStatus {
  service: string;
  installed: boolean;
  running: boolean;
  version: string;
  certbot_version: string;
  https_ready: boolean;
  checked_at: string | null;
  error: string | null;
}

// Status states for UI
export type NginxVerificationState = 
  | 'unknown'        // No verification ever done
  | 'checking'       // Verification in progress
  | 'verified'       // Recently verified as running
  | 'stale'          // Verification is old (> 5 min)
  | 'offline'        // Verified but not running
  | 'not_installed'; // Verified as not installed

const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
const RUNNER_OFFLINE_THRESHOLD_MS = 60 * 1000; // 60 seconds

export interface UseNginxRuntimeStatusOptions {
  infraCapabilities: Record<string, unknown>;
  orders: Order[];
  runnerId?: string;
  runnerLastSeenAt?: string | null;
  infrastructureId?: string;
}

export interface UseNginxRuntimeStatusResult {
  runtimeStatus: NginxRuntimeStatus | null;
  verificationState: NginxVerificationState;
  isChecking: boolean;
  lastVerifiedAt: Date | null;
  staleReason: string | null;
  triggerVerification: () => Promise<void>;
}

// Parse Nginx runtime status from order stdout
function parseNginxRuntimeFromOrder(order: Order): NginxRuntimeStatus | null {
  if (!order.stdout_tail) return null;
  
  try {
    // Find JSON in stdout (may be mixed with other output)
    const jsonMatch = order.stdout_tail.match(/\{[\s\S]*"service"\s*:\s*"nginx"[\s\S]*\}/);
    if (!jsonMatch) return null;
    
    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed.service !== 'nginx') return null;
    
    return {
      service: 'nginx',
      installed: parsed.installed === true,
      running: parsed.running === true,
      version: parsed.version || 'unknown',
      certbot_version: parsed.certbot_version || 'not_installed',
      https_ready: parsed.https_ready === true,
      checked_at: parsed.checked_at || null,
      error: parsed.error || null,
    };
  } catch {
    return null;
  }
}

// Extract last verified timestamp from capabilities
function getLastVerifiedFromCapabilities(capabilities: Record<string, unknown>): Date | null {
  const lastVerified = capabilities['nginx.last_verified'];
  if (typeof lastVerified === 'string') {
    const date = new Date(lastVerified);
    if (!isNaN(date.getTime())) return date;
  }
  return null;
}

// Check if runner is considered online
function isRunnerOnline(lastSeenAt: string | null | undefined): boolean {
  if (!lastSeenAt) return false;
  const lastSeen = new Date(lastSeenAt);
  return Date.now() - lastSeen.getTime() < RUNNER_OFFLINE_THRESHOLD_MS;
}

export function useNginxRuntimeStatus({
  infraCapabilities,
  orders,
  runnerId,
  runnerLastSeenAt,
  infrastructureId,
}: UseNginxRuntimeStatusOptions): UseNginxRuntimeStatusResult {
  const createOrder = useCreateOrder();
  
  // Find the most recent Nginx verify order
  const lastVerifyOrder = useMemo(() => {
    return orders.find(o => 
      o.description?.includes('[proxy.nginx.verify]') &&
      (o.status === 'completed' || o.status === 'failed' || o.status === 'running' || o.status === 'pending')
    );
  }, [orders]);
  
  // Check if a verification is in progress
  const isChecking = useMemo(() => {
    return lastVerifyOrder?.status === 'running' || lastVerifyOrder?.status === 'pending';
  }, [lastVerifyOrder]);
  
  // Parse runtime status from the last completed order
  const runtimeStatus = useMemo((): NginxRuntimeStatus | null => {
    if (!lastVerifyOrder || lastVerifyOrder.status !== 'completed') return null;
    return parseNginxRuntimeFromOrder(lastVerifyOrder);
  }, [lastVerifyOrder]);
  
  // Determine last verified timestamp
  const lastVerifiedAt = useMemo((): Date | null => {
    // First, check from parsed runtime status
    if (runtimeStatus?.checked_at) {
      const date = new Date(runtimeStatus.checked_at);
      if (!isNaN(date.getTime())) return date;
    }
    
    // Fallback to capabilities
    return getLastVerifiedFromCapabilities(infraCapabilities);
  }, [runtimeStatus, infraCapabilities]);
  
  // Calculate verification state
  const { verificationState, staleReason } = useMemo((): { 
    verificationState: NginxVerificationState; 
    staleReason: string | null;
  } => {
    // If verification is in progress
    if (isChecking) {
      return { verificationState: 'checking', staleReason: null };
    }
    
    // If runner went offline, mark as stale
    const runnerOnline = isRunnerOnline(runnerLastSeenAt);
    if (!runnerOnline && lastVerifiedAt) {
      return { 
        verificationState: 'stale', 
        staleReason: 'Le runner est hors ligne' 
      };
    }
    
    // If no verification ever done
    if (!lastVerifiedAt && !runtimeStatus) {
      // Check if we have a declared capability (from old orders)
      const declaredInstalled = infraCapabilities['nginx.installed'] === 'installed';
      if (declaredInstalled) {
        return { 
          verificationState: 'stale', 
          staleReason: 'État déclaré sans preuve runtime' 
        };
      }
      return { verificationState: 'unknown', staleReason: null };
    }
    
    // Check if verification is stale
    if (lastVerifiedAt) {
      const age = Date.now() - lastVerifiedAt.getTime();
      if (age > STALE_THRESHOLD_MS) {
        return { 
          verificationState: 'stale', 
          staleReason: `Dernière vérification il y a ${Math.round(age / 60000)} minutes` 
        };
      }
    }
    
    // Check runtime status
    if (runtimeStatus) {
      if (!runtimeStatus.installed) {
        return { verificationState: 'not_installed', staleReason: null };
      }
      if (!runtimeStatus.running) {
        return { verificationState: 'offline', staleReason: null };
      }
      return { verificationState: 'verified', staleReason: null };
    }
    
    // Fallback based on capabilities
    const verifiedCap = infraCapabilities['nginx.verified'];
    if (verifiedCap === 'verified') {
      return { verificationState: 'verified', staleReason: null };
    }
    
    return { verificationState: 'unknown', staleReason: null };
  }, [isChecking, runnerLastSeenAt, lastVerifiedAt, runtimeStatus, infraCapabilities]);
  
  // Trigger a new verification
  const triggerVerification = useCallback(async () => {
    if (!runnerId) {
      toast({
        title: 'Erreur',
        description: 'Aucun runner associé à cette infrastructure',
        variant: 'destructive',
      });
      return;
    }
    
    const playbook = getNginxPlaybookById('proxy.nginx.verify');
    if (!playbook) {
      toast({
        title: 'Erreur',
        description: 'Playbook de vérification Nginx non trouvé',
        variant: 'destructive',
      });
      return;
    }
    
    await createOrder.mutateAsync({
      runner_id: runnerId,
      infrastructure_id: infrastructureId,
      category: 'detection',
      name: 'Vérification Runtime Nginx',
      description: `[${playbook.id}] ${playbook.description}`,
      command: playbook.command,
    });
  }, [runnerId, infrastructureId, createOrder]);
  
  return {
    runtimeStatus,
    verificationState,
    isChecking,
    lastVerifiedAt,
    staleReason,
    triggerVerification,
  };
}

// Helper to check if Nginx is ready for deployment
export function isNginxReadyForDeployment(
  verificationState: NginxVerificationState,
  runtimeStatus: NginxRuntimeStatus | null
): boolean {
  if (verificationState !== 'verified') return false;
  if (!runtimeStatus) return false;
  return runtimeStatus.installed && runtimeStatus.running;
}
