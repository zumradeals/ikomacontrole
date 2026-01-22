/**
 * ORDERS HOOK
 * 
 * ARCHITECTURE (API-First):
 * - The external API (api.ikomadigit.com) is the SOURCE OF TRUTH
 * - Local Supabase is used ONLY for real-time UI updates via Realtime
 * - Status mapping: API uses QUEUED/RUNNING/SUCCEEDED/FAILED/CANCELLED
 *   → Frontend displays as pending/running/completed/failed/cancelled
 * 
 * The frontend is PASSIVE and DESCRIPTIVE:
 * - Never recalculates status
 * - Never interprets playbook results
 * - Displays reportContract as-is from the API
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Json } from '@/integrations/supabase/types';
import { 
  createOrder as createExternalOrder, 
  listOrders as listExternalOrders, 
  cancelOrder as cancelExternalOrder,
  type LocalOrderStatus,
  type ReportContract,
} from '@/lib/api/ordersAdminProxy';

export type OrderStatus = LocalOrderStatus;
export type OrderCategory = 'installation' | 'update' | 'security' | 'maintenance' | 'detection';

export interface Order {
  id: string;
  runner_id: string;
  infrastructure_id: string | null;
  category: OrderCategory;
  name: string;
  description: string | null;
  command: string;
  status: OrderStatus;
  progress: number | null;
  result: Json;
  error_message: string | null;
  exit_code: number | null;
  stdout_tail: string | null;
  stderr_tail: string | null;
  report_incomplete: boolean | null;
  meta: Json;
  created_by: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
}

export interface CreateOrderInput {
  runner_id: string;
  server_id?: string | null;
  category: OrderCategory;
  name: string;
  description?: string;
  command: string;
  playbook_key?: string;
  /** @deprecated Use server_id instead */
  infrastructure_id?: string | null;
}

function extractPlaybookKeyFromDescription(description?: string | null): string | null {
  if (!description) return null;
  const match = description.match(/^\[([a-z0-9_.-]+)\]/i);
  return match?.[1] ?? null;
}

// Map category to action for external API
function categoryToAction(category: OrderCategory): string {
  switch (category) {
    case 'installation': return 'install';
    case 'update': return 'update';
    case 'security': return 'security';
    case 'maintenance': return 'maintenance';
    case 'detection': return 'detect';
    default: return 'run';
  }
}

/**
 * Fetch orders from external API and merge with local Supabase for real-time updates.
 */
export function useOrders(runnerId?: string, serverId?: string) {
  return useQuery({
    queryKey: ['orders', runnerId, serverId],
    queryFn: async () => {
      // Fetch from local Supabase for real-time tracking
      let query = supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (runnerId) {
        query = query.eq('runner_id', runnerId);
      }

      const { data: localData, error: localError } = await query;
      
      if (localError) {
        console.error('Error fetching local orders:', localError);
      }

      // Sync with external API - API is the source of truth
      // We read from API and update local cache for realtime tracking only
      if (serverId) {
        try {
          const externalResult = await listExternalOrders(serverId);
          if (externalResult.success && externalResult.data) {
            const externalMap = new Map(externalResult.data.map(o => [o.id, o]));
            
            // Update local orders with external status (API is source of truth)
            for (const localOrder of (localData || [])) {
              const external = externalMap.get(localOrder.id);
              if (external) {
                // Only update if status changed - passive sync
                const needsUpdate = external.status !== localOrder.status ||
                  external.exitCode !== localOrder.exit_code;
                
                if (needsUpdate) {
                  await supabase
                    .from('orders')
                    .update({
                      status: external.status,
                      exit_code: external.exitCode,
                      stdout_tail: external.stdoutTail,
                      stderr_tail: external.stderrTail,
                      completed_at: external.completedAt,
                      started_at: external.startedAt,
                      result: external.result as Json,
                    })
                    .eq('id', localOrder.id);
                }
              }
            }
          }
        } catch (err) {
          console.warn('[useOrders] API sync failed (will retry):', err);
        }
      }

      return (localData || []) as Order[];
    },
    enabled: !!runnerId || !!serverId,
    refetchInterval: 5000, // Poll every 5 seconds for updates
  });
}

/**
 * Create a new order via the EXTERNAL API.
 * Also creates a local copy for real-time tracking.
 */
export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateOrderInput) => {
      const playbookKey =
        input.playbook_key ||
        extractPlaybookKeyFromDescription(input.description) ||
        `${input.category}.custom`;
      const action = categoryToAction(input.category);
      const serverId = input.server_id || input.infrastructure_id;
      
      console.log('[useCreateOrder] Creating order:', {
        serverId,
        playbookKey,
        action,
        name: input.name,
        hasServerId: !!serverId,
      });

      // If we have a serverId (server-centric orchestration), create via external API.
      // IMPORTANT: do NOT silently fall back to local orders, otherwise orders get stuck in "pending".
      if (serverId) {
        const externalResult = await createExternalOrder({
          serverId,
          playbookKey,
          action,
          createdBy: 'dashboard',
          name: input.name,
          command: input.command,
          description: input.description,
        });

        if (!externalResult.success || !externalResult.data) {
          throw new Error(
            externalResult.error ||
              "Impossible d'envoyer l'ordre à l'agent (service d'ordres indisponible)."
          );
        }

        console.log('[useCreateOrder] External order created:', externalResult.data);

        // Also create a local copy for real-time tracking via Supabase Realtime
        const meta = {
          server_id: serverId,
          external_id: externalResult.data.id,
          playbook_key: playbookKey,
        };

        const { data: localOrder, error: localError } = await supabase
          .from('orders')
          .insert({
            id: externalResult.data.id,
            runner_id: input.runner_id,
            infrastructure_id: input.infrastructure_id || null,
            category: input.category,
            name: input.name,
            description: input.description || null,
            command: input.command,
            status: 'pending',
            meta,
          })
          .select()
          .single();

        if (localError) {
          console.warn('[useCreateOrder] Local insert failed (may already exist):', localError);
        }

        return localOrder || externalResult.data;
      }

      // Fallback: Create locally only (for backwards compatibility or when external API unavailable)
      const meta = input.server_id ? { server_id: input.server_id } : {};
      
      const { data, error } = await supabase
        .from('orders')
        .insert({
          runner_id: input.runner_id,
          infrastructure_id: input.infrastructure_id || null,
          category: input.category,
          name: input.name,
          description: input.description || null,
          command: input.command,
          status: 'pending',
          meta,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating order:', error);
        throw error;
      }
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['orders', variables.runner_id] });
      queryClient.invalidateQueries({ queryKey: ['orders', undefined, variables.server_id] });
      toast({
        title: 'Ordre créé',
        description: `L'ordre "${variables.name}" a été envoyé au runner.`,
      });
    },
    onError: (error: Error) => {
      console.error('[useCreateOrder] Error:', error);
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Cancel a pending order.
 */
export function useCancelOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, runnerId }: { orderId: string; runnerId: string }) => {
      // Try to cancel on external API first
      try {
        await cancelExternalOrder(orderId);
      } catch (err) {
        console.warn('[useCancelOrder] External cancel failed:', err);
      }

      // Also update local status
      const { error } = await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', orderId)
        .eq('status', 'pending');

      if (error) throw error;
      return { orderId, runnerId };
    },
    onSuccess: ({ runnerId }) => {
      queryClient.invalidateQueries({ queryKey: ['orders', runnerId] });
      toast({
        title: 'Ordre annulé',
        description: 'L\'ordre a été annulé.',
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
