/**
 * INFRASTRUCTURES HOOK
 * 
 * Infrastructures are managed locally in Supabase because they are 
 * created/edited by this control plane. The external API only knows
 * about infrastructureId as a reference field on runners.
 * 
 * IMPORTANT: useAssociateRunner now uses the admin-proxy to update
 * the runner on the external API (source of truth for runners).
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { Json } from '@/integrations/supabase/types';
import { attachRunnerToServer, detachRunnerFromServer } from '@/lib/api/ordersAdminProxy';

export interface Infrastructure {
  id: string;
  name: string;
  type: 'vps' | 'bare_metal' | 'cloud';
  os: string | null;
  distribution: string | null;
  architecture: string | null;
  cpu_cores: number | null;
  ram_gb: number | null;
  disk_gb: number | null;
  capabilities: Record<string, unknown>;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface InfrastructureInput {
  name: string;
  type: 'vps' | 'bare_metal' | 'cloud';
  os?: string | null;
  distribution?: string | null;
  architecture?: string | null;
  cpu_cores?: number | null;
  ram_gb?: number | null;
  disk_gb?: number | null;
  capabilities?: Record<string, unknown>;
  notes?: string | null;
}

export function useInfrastructures() {
  const query = useQuery({
    queryKey: ['infrastructures'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('infrastructures')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[useInfrastructures] Fetch error:', error);
        throw error;
      }

      return data as Infrastructure[];
    },
  });

  // Subscribe to realtime changes
  useEffect(() => {
    const channel = supabase
      .channel('infrastructures-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'infrastructures'
        },
        () => {
          query.refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [query]);

  return query;
}

export function useCreateInfrastructure() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: InfrastructureInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const insertData = {
        name: input.name,
        type: input.type,
        os: input.os,
        distribution: input.distribution,
        architecture: input.architecture,
        cpu_cores: input.cpu_cores,
        ram_gb: input.ram_gb,
        disk_gb: input.disk_gb,
        capabilities: (input.capabilities || {}) as Json,
        notes: input.notes,
        created_by: user?.id || null,
      };
      
      const { data, error } = await supabase
        .from('infrastructures')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('[useCreateInfrastructure] Insert error:', error, { input });
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['infrastructures'] });
      toast({
        title: 'Infrastructure créée',
        description: 'L\'infrastructure a été créée avec succès.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur',
        description: `Impossible de créer l'infrastructure: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateInfrastructure() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: InfrastructureInput & { id: string }) => {
      const updateData = {
        name: input.name,
        type: input.type,
        os: input.os,
        distribution: input.distribution,
        architecture: input.architecture,
        cpu_cores: input.cpu_cores,
        ram_gb: input.ram_gb,
        disk_gb: input.disk_gb,
        capabilities: (input.capabilities || {}) as Json,
        notes: input.notes,
      };
      
      const { data, error } = await supabase
        .from('infrastructures')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('[useUpdateInfrastructure] Update error:', error, { id, input });
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['infrastructures'] });
      toast({
        title: 'Infrastructure mise à jour',
        description: 'L\'infrastructure a été mise à jour avec succès.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur',
        description: `Impossible de mettre à jour l'infrastructure: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteInfrastructure() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('infrastructures')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('[useDeleteInfrastructure] Delete error:', error, { id });
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['infrastructures'] });
      queryClient.invalidateQueries({ queryKey: ['runners'] });
      queryClient.invalidateQueries({ queryKey: ['proxy-runners'] });
      queryClient.invalidateQueries({ queryKey: ['proxy-runners-v2'] });
      toast({
        title: 'Infrastructure supprimée',
        description: 'L\'infrastructure a été supprimée avec succès.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur',
        description: `Impossible de supprimer l'infrastructure: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Associate/dissociate a runner with an infrastructure.
 * 
 * IMPORTANT: This now uses the admin-proxy to update the external API.
 * The external Orders API is the source of truth for runner associations.
 */
export function useAssociateRunner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ runnerId, infrastructureId }: { runnerId: string; infrastructureId: string | null }) => {
      console.log('[useAssociateRunner] Via admin-proxy:', { runnerId, infrastructureId });
      
      if (infrastructureId) {
        // Attach runner to infrastructure
        const result = await attachRunnerToServer(infrastructureId, runnerId);
        if (!result.success) {
          throw new Error(result.error || 'Failed to associate runner');
        }
      } else {
        // Detach runner from infrastructure
        const result = await detachRunnerFromServer(runnerId);
        if (!result.success) {
          throw new Error(result.error || 'Failed to dissociate runner');
        }
      }
    },
    onSuccess: (_, { infrastructureId }) => {
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ['runners'] });
      queryClient.invalidateQueries({ queryKey: ['proxy-runners'] });
      queryClient.invalidateQueries({ queryKey: ['proxy-runners-v2'] });
      queryClient.invalidateQueries({ queryKey: ['infrastructures'] });
      
      toast({
        title: infrastructureId ? 'Runner associé' : 'Runner dissocié',
        description: infrastructureId 
          ? 'Le runner a été associé à l\'infrastructure via l\'API.'
          : 'Le runner a été dissocié de l\'infrastructure.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur',
        description: `Impossible de modifier l'association: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
}
