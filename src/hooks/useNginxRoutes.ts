import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface NginxRoute {
  id: string;
  infrastructure_id: string;
  domain: string;
  subdomain: string | null;
  full_domain: string | null;
  backend_host: string;
  backend_port: number;
  backend_protocol: string;
  https_enabled: boolean;
  https_status: string; // 'pending' | 'provisioning' | 'ok' | 'failed'
  consumed_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  proxy_type?: string; // 'nginx' | 'caddy'
}

export interface CreateNginxRouteInput {
  infrastructure_id: string;
  domain: string;
  subdomain?: string | null;
  full_domain?: string | null;
  backend_host: string;
  backend_port: number;
  backend_protocol?: string;
  https_status?: string;
  notes?: string | null;
}

export interface UpdateNginxRouteInput {
  id: string;
  domain?: string;
  subdomain?: string | null;
  full_domain?: string | null;
  backend_host?: string;
  backend_port?: number;
  backend_protocol?: string;
  https_enabled?: boolean;
  https_status?: string;
  consumed_by?: string | null;
  notes?: string | null;
}

// Fetch all Nginx routes for an infrastructure
export function useNginxRoutes(infrastructureId?: string) {
  return useQuery({
    queryKey: ["nginx-routes", infrastructureId],
    queryFn: async () => {
      let query = supabase
        .from("caddy_routes")
        .select("*")
        .order("created_at", { ascending: false });

      if (infrastructureId) {
        query = query.eq("infrastructure_id", infrastructureId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as NginxRoute[];
    },
    enabled: !!infrastructureId,
  });
}

// Fetch available (not consumed and HTTPS OK) routes
export function useAvailableNginxRoutes(infrastructureId?: string) {
  return useQuery({
    queryKey: ["nginx-routes-available", infrastructureId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("caddy_routes")
        .select("*")
        .eq("infrastructure_id", infrastructureId)
        .is("consumed_by", null)
        .eq("https_status", "ok")
        .order("domain", { ascending: true });

      if (error) throw error;
      return data as NginxRoute[];
    },
    enabled: !!infrastructureId,
  });
}

// Fetch routes with HTTPS ready
export function useHttpsReadyNginxRoutes(infrastructureId?: string) {
  return useQuery({
    queryKey: ["nginx-routes-https-ready", infrastructureId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("caddy_routes")
        .select("*")
        .eq("infrastructure_id", infrastructureId)
        .eq("https_status", "ok")
        .order("domain", { ascending: true });

      if (error) throw error;
      return data as NginxRoute[];
    },
    enabled: !!infrastructureId,
  });
}

// Create a new Nginx route
export function useCreateNginxRoute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateNginxRouteInput) => {
      const { data, error } = await supabase
        .from("caddy_routes")
        .insert({
          infrastructure_id: input.infrastructure_id,
          domain: input.domain,
          subdomain: input.subdomain || null,
          full_domain: input.full_domain || null,
          backend_host: input.backend_host,
          backend_port: input.backend_port,
          backend_protocol: input.backend_protocol || "http",
          https_status: input.https_status || "pending",
          notes: input.notes || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data as NginxRoute;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["nginx-routes"] });
      queryClient.invalidateQueries({ queryKey: ["nginx-routes-available"] });
      queryClient.invalidateQueries({ queryKey: ["nginx-routes-https-ready"] });
    },
  });
}

// Update an existing Nginx route
export function useUpdateNginxRoute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateNginxRouteInput) => {
      const { id, ...updates } = input;
      const { data, error } = await supabase
        .from("caddy_routes")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as NginxRoute;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nginx-routes"] });
      queryClient.invalidateQueries({ queryKey: ["nginx-routes-available"] });
      queryClient.invalidateQueries({ queryKey: ["nginx-routes-https-ready"] });
    },
  });
}

// Delete a Nginx route
export function useDeleteNginxRoute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (routeId: string) => {
      const { error } = await supabase
        .from("caddy_routes")
        .delete()
        .eq("id", routeId);

      if (error) throw error;
      return routeId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nginx-routes"] });
      queryClient.invalidateQueries({ queryKey: ["nginx-routes-available"] });
      queryClient.invalidateQueries({ queryKey: ["nginx-routes-https-ready"] });
    },
  });
}

// Consume a route
export function useConsumeNginxRoute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ routeId, consumedBy }: { routeId: string; consumedBy: string }) => {
      const { data, error } = await supabase
        .from("caddy_routes")
        .update({ consumed_by: consumedBy })
        .eq("id", routeId)
        .select()
        .single();

      if (error) throw error;
      return data as NginxRoute;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nginx-routes"] });
      queryClient.invalidateQueries({ queryKey: ["nginx-routes-available"] });
    },
  });
}

// Release a consumed route
export function useReleaseNginxRoute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (routeId: string) => {
      const { data, error } = await supabase
        .from("caddy_routes")
        .update({ consumed_by: null })
        .eq("id", routeId)
        .select()
        .single();

      if (error) throw error;
      return data as NginxRoute;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nginx-routes"] });
      queryClient.invalidateQueries({ queryKey: ["nginx-routes-available"] });
    },
  });
}

// Fetch routes by consumer
export function useNginxRoutesByConsumer(consumedBy: string) {
  return useQuery({
    queryKey: ["nginx-routes-by-consumer", consumedBy],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("caddy_routes")
        .select("*")
        .eq("consumed_by", consumedBy)
        .order("domain", { ascending: true });

      if (error) throw error;
      return data as NginxRoute[];
    },
    enabled: !!consumedBy,
  });
}
