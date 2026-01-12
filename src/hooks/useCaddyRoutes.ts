import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface CaddyRoute {
  id: string;
  infrastructure_id: string;
  domain: string;
  subdomain: string | null;
  full_domain: string;
  backend_host: string;
  backend_port: number;
  backend_protocol: string;
  https_enabled: boolean;
  https_status: 'pending' | 'provisioning' | 'ok' | 'failed';
  consumed_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface CreateCaddyRouteInput {
  infrastructure_id: string;
  domain: string;
  subdomain?: string | null;
  backend_host?: string;
  backend_port?: number;
  backend_protocol?: string;
  https_enabled?: boolean;
  consumed_by?: string | null;
  notes?: string | null;
}

export interface UpdateCaddyRouteInput {
  id: string;
  backend_host?: string;
  backend_port?: number;
  backend_protocol?: string;
  https_enabled?: boolean;
  https_status?: 'pending' | 'provisioning' | 'ok' | 'failed';
  consumed_by?: string | null;
  notes?: string | null;
}

// Fetch all routes for an infrastructure
export function useCaddyRoutes(infrastructureId?: string) {
  return useQuery({
    queryKey: ['caddy-routes', infrastructureId],
    queryFn: async () => {
      let query = supabase
        .from('caddy_routes')
        .select('*')
        .order('full_domain', { ascending: true });
      
      if (infrastructureId) {
        query = query.eq('infrastructure_id', infrastructureId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as CaddyRoute[];
    },
    enabled: true,
  });
}

// Fetch available (not consumed) routes for an infrastructure
export function useAvailableCaddyRoutes(infrastructureId?: string) {
  return useQuery({
    queryKey: ['caddy-routes-available', infrastructureId],
    queryFn: async () => {
      if (!infrastructureId) return [];
      
      const { data, error } = await supabase
        .from('caddy_routes')
        .select('*')
        .eq('infrastructure_id', infrastructureId)
        .is('consumed_by', null)
        .eq('https_status', 'ok')
        .order('full_domain', { ascending: true });
      
      if (error) throw error;
      return data as CaddyRoute[];
    },
    enabled: !!infrastructureId,
  });
}

// Fetch routes with HTTPS OK status for Supabase selection
export function useHttpsReadyRoutes(infrastructureId?: string) {
  return useQuery({
    queryKey: ['caddy-routes-https-ready', infrastructureId],
    queryFn: async () => {
      if (!infrastructureId) return [];
      
      const { data, error } = await supabase
        .from('caddy_routes')
        .select('*')
        .eq('infrastructure_id', infrastructureId)
        .eq('https_status', 'ok')
        .order('full_domain', { ascending: true });
      
      if (error) throw error;
      return data as CaddyRoute[];
    },
    enabled: !!infrastructureId,
  });
}

// Create route mutation
export function useCreateCaddyRoute() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: CreateCaddyRouteInput) => {
      const { data, error } = await supabase
        .from('caddy_routes')
        .insert({
          infrastructure_id: input.infrastructure_id,
          domain: input.domain,
          subdomain: input.subdomain || null,
          backend_host: input.backend_host || 'localhost',
          backend_port: input.backend_port || 3000,
          backend_protocol: input.backend_protocol || 'http',
          https_enabled: input.https_enabled ?? true,
          consumed_by: input.consumed_by || null,
          notes: input.notes || null,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data as CaddyRoute;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['caddy-routes'] });
      toast({
        title: 'Route créée',
        description: `${data.full_domain} ajouté au registre`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Update route mutation
export function useUpdateCaddyRoute() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: UpdateCaddyRouteInput) => {
      const { id, ...updates } = input;
      const { data, error } = await supabase
        .from('caddy_routes')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as CaddyRoute;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caddy-routes'] });
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Delete route mutation
export function useDeleteCaddyRoute() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('caddy_routes')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caddy-routes'] });
      toast({
        title: 'Route supprimée',
        description: 'Le domaine a été retiré du registre',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Mark route as consumed
export function useConsumeRoute() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, consumedBy }: { id: string; consumedBy: string }) => {
      const { data, error } = await supabase
        .from('caddy_routes')
        .update({ consumed_by: consumedBy })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as CaddyRoute;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caddy-routes'] });
    },
  });
}

// Release a consumed route
export function useReleaseRoute() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('caddy_routes')
        .update({ consumed_by: null })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as CaddyRoute;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caddy-routes'] });
    },
  });
}

// Helper to get routes for a specific consumer
export function useRoutesByConsumer(consumedBy: string) {
  return useQuery({
    queryKey: ['caddy-routes-by-consumer', consumedBy],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('caddy_routes')
        .select('*')
        .eq('consumed_by', consumedBy)
        .order('full_domain', { ascending: true });
      
      if (error) throw error;
      return data as CaddyRoute[];
    },
  });
}
