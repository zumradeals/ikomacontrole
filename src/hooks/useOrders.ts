/**
 * ORDERS HOOK
 * 
 * NOTE: Orders are created/stored in the local Supabase database and synced
 * with the runner-api Edge Function. This is intentional because:
 * 1. Orders are created by the control plane (this app)
 * 2. Runners poll the runner-api to claim orders
 * 3. Results are reported back and stored in Supabase
 * 
 * The local Supabase 'orders' table IS the source of truth for order state
 * because this control plane creates and manages orders.
 * 
 * This is different from 'runners' where the external API is the source of truth.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Json } from '@/integrations/supabase/types';

export type OrderStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
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
  infrastructure_id?: string | null;
  category: OrderCategory;
  name: string;
  description?: string;
  command: string;
}

/**
 * Fetch orders from local Supabase.
 * Orders are managed locally because this control plane creates them.
 * 
 * NOTE: This uses Supabase directly because orders originate from this app.
 */
export function useOrders(runnerId?: string) {
  return useQuery({
    queryKey: ['orders', runnerId],
    queryFn: async () => {
      let query = supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (runnerId) {
        query = query.eq('runner_id', runnerId);
      }

      const { data, error } = await query;
      if (error) {
        console.error('Error fetching orders:', error);
        throw error;
      }
      return data as Order[];
    },
    enabled: !!runnerId,
  });
}

/**
 * Create a new order in local Supabase.
 * The runner will pick this up via the runner-api Edge Function.
 */
export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateOrderInput) => {
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
      toast({
        title: 'Ordre créé',
        description: `L'ordre "${variables.name}" a été envoyé au runner.`,
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
 * Cancel a pending order.
 */
export function useCancelOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, runnerId }: { orderId: string; runnerId: string }) => {
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
