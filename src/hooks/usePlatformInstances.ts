import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Json } from '@/integrations/supabase/types';

export type PlatformInstanceStatus = 'pending' | 'installed' | 'failed' | 'stopped';

export interface PlatformInstance {
  id: string;
  infrastructure_id: string;
  service_type: string;
  status: PlatformInstanceStatus;
  
  // Supabase-specific credentials
  supabase_url: string | null;
  supabase_anon_key: string | null;
  supabase_service_role_key: string | null;
  supabase_project_ref: string | null;
  supabase_jwt_secret: string | null;
  supabase_postgres_password: string | null;
  
  // Generic config
  config: Json;
  
  // Metadata
  domain: string | null;
  port: number | null;
  installed_at: string | null;
  last_verified_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupabaseCredentials {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
  projectRef?: string;
}

// Fetch all platform instances
export function usePlatformInstances(infrastructureId?: string) {
  return useQuery({
    queryKey: ['platform-instances', infrastructureId],
    queryFn: async () => {
      let query = supabase
        .from('platform_instances')
        .select('*')
        .order('created_at', { ascending: false });

      if (infrastructureId) {
        query = query.eq('infrastructure_id', infrastructureId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as PlatformInstance[];
    },
  });
}

// Fetch specific Supabase instance for an infrastructure
export function useSupabaseInstance(infrastructureId: string | undefined) {
  return useQuery({
    queryKey: ['supabase-instance', infrastructureId],
    queryFn: async () => {
      if (!infrastructureId) return null;

      const { data, error } = await supabase
        .from('platform_instances')
        .select('*')
        .eq('infrastructure_id', infrastructureId)
        .eq('service_type', 'supabase')
        .eq('status', 'installed')
        .maybeSingle();

      if (error) throw error;
      return data as PlatformInstance | null;
    },
    enabled: !!infrastructureId,
  });
}

// Get Supabase credentials from an instance (safe version without service role key for frontend)
export function getSupabaseCredentialsForFrontend(instance: PlatformInstance | null): SupabaseCredentials | null {
  if (!instance || !instance.supabase_url || !instance.supabase_anon_key) {
    return null;
  }

  return {
    url: instance.supabase_url,
    anonKey: instance.supabase_anon_key,
    projectRef: instance.supabase_project_ref || undefined,
    // Never include service role key for frontend
  };
}

// Get Supabase credentials from an instance (full version for backend)
export function getSupabaseCredentialsForBackend(instance: PlatformInstance | null): SupabaseCredentials | null {
  if (!instance || !instance.supabase_url || !instance.supabase_anon_key) {
    return null;
  }

  return {
    url: instance.supabase_url,
    anonKey: instance.supabase_anon_key,
    serviceRoleKey: instance.supabase_service_role_key || undefined,
    projectRef: instance.supabase_project_ref || undefined,
  };
}

// Create or update a platform instance
export function useUpsertPlatformInstance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      infrastructure_id: string;
      service_type: string;
      status?: PlatformInstanceStatus;
      supabase_url?: string;
      supabase_anon_key?: string;
      supabase_service_role_key?: string;
      supabase_project_ref?: string;
      supabase_jwt_secret?: string;
      supabase_postgres_password?: string;
      config?: Json;
      domain?: string;
      port?: number;
      installed_at?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();

      // Check if instance exists
      const { data: existing } = await supabase
        .from('platform_instances')
        .select('id')
        .eq('infrastructure_id', input.infrastructure_id)
        .eq('service_type', input.service_type)
        .maybeSingle();

      if (existing) {
        // Update
        const { data, error } = await supabase
          .from('platform_instances')
          .update({
            status: input.status,
            supabase_url: input.supabase_url,
            supabase_anon_key: input.supabase_anon_key,
            supabase_service_role_key: input.supabase_service_role_key,
            supabase_project_ref: input.supabase_project_ref,
            supabase_jwt_secret: input.supabase_jwt_secret,
            supabase_postgres_password: input.supabase_postgres_password,
            config: input.config,
            domain: input.domain,
            port: input.port,
            installed_at: input.installed_at,
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        return data as PlatformInstance;
      } else {
        // Insert
        const { data, error } = await supabase
          .from('platform_instances')
          .insert({
            infrastructure_id: input.infrastructure_id,
            service_type: input.service_type,
            status: input.status || 'pending',
            supabase_url: input.supabase_url,
            supabase_anon_key: input.supabase_anon_key,
            supabase_service_role_key: input.supabase_service_role_key,
            supabase_project_ref: input.supabase_project_ref,
            supabase_jwt_secret: input.supabase_jwt_secret,
            supabase_postgres_password: input.supabase_postgres_password,
            config: input.config,
            domain: input.domain,
            port: input.port,
            installed_at: input.installed_at,
            created_by: user?.id,
          })
          .select()
          .single();

        if (error) throw error;
        return data as PlatformInstance;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['platform-instances'] });
      queryClient.invalidateQueries({ queryKey: ['supabase-instance', data.infrastructure_id] });
      toast.success('Instance Platform mise à jour');
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });
}

// Delete a platform instance
export function useDeletePlatformInstance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('platform_instances')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-instances'] });
      toast.success('Instance supprimée');
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });
}

// Update instance status
export function useUpdateInstanceStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status, installedAt }: { 
      id: string; 
      status: PlatformInstanceStatus;
      installedAt?: string;
    }) => {
      const { data, error } = await supabase
        .from('platform_instances')
        .update({
          status,
          installed_at: installedAt || undefined,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as PlatformInstance;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['platform-instances'] });
      queryClient.invalidateQueries({ queryKey: ['supabase-instance', data.infrastructure_id] });
    },
  });
}
