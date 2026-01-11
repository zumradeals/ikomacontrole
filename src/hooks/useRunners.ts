import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface Runner {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'paused' | 'unknown';
  capabilities: Record<string, unknown>;
  host_info: Record<string, unknown>;
  infrastructure_id: string | null;
  last_seen_at: string | null;
  created_at: string;
}

// Consider a runner offline if last_seen_at is older than 60 seconds
const OFFLINE_THRESHOLD_MS = 60 * 1000;

function computeEffectiveStatus(runner: Runner): Runner['status'] {
  if (runner.status === 'paused') return 'paused';
  
  if (!runner.last_seen_at) return 'unknown';
  
  const lastSeen = new Date(runner.last_seen_at).getTime();
  const now = Date.now();
  
  if (now - lastSeen > OFFLINE_THRESHOLD_MS) {
    return 'offline';
  }
  
  return 'online';
}

export function useRunners() {
  const query = useQuery({
    queryKey: ['runners'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('runners')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Compute effective status based on last_seen_at
      return (data as Runner[]).map(runner => ({
        ...runner,
        status: computeEffectiveStatus(runner)
      }));
    },
    refetchInterval: 10000, // Refetch every 10 seconds
  });

  // Subscribe to realtime changes
  useEffect(() => {
    const channel = supabase
      .channel('runners-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'runners'
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

export function useDeleteRunner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (runnerId: string) => {
      const { error } = await supabase
        .from('runners')
        .delete()
        .eq('id', runnerId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['runners'] });
      toast({
        title: 'Runner supprimé',
        description: 'Le runner a été supprimé avec succès.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: `Impossible de supprimer le runner: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
}
