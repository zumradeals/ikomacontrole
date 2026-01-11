import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface Setting {
  id: string;
  key: string;
  value: string | null;
  description: string | null;
  updated_at: string;
}

export function useSettings() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading, error } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settings')
        .select('*');
      
      if (error) throw error;
      return data as Setting[];
    },
  });

  const getSetting = (key: string): string => {
    const setting = settings?.find(s => s.key === key);
    return setting?.value || '';
  };

  const updateSettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('settings')
        .update({ value, updated_by: user?.id })
        .eq('key', key);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  return {
    settings,
    isLoading,
    error,
    getSetting,
    updateSetting: (key: string, value: string) => 
      updateSettingMutation.mutate({ key, value }),
    isUpdating: updateSettingMutation.isPending,
  };
}
