import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';

interface Setting {
  id: string;
  key: string;
  value: string | null;
  description: string | null;
  updated_at: string;
}

export function useSettings() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: settings, isLoading, error } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settings')
        .select('*');
      
      if (error) throw error;
      return data as Setting[];
    },
    enabled: !!user, // Only fetch if user is logged in
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
      updateSettingMutation.mutateAsync({ key, value }),
    isUpdating: updateSettingMutation.isPending,
  };
}

// Hook to read a single setting value (read-only)
export function useSetting(key: string) {
  const { getSetting, isLoading } = useSettings();
  
  return {
    value: getSetting(key),
    isLoading,
  };
}

// Hook for controlled input with local state
export function useSettingInput(key: string) {
  const { getSetting, updateSetting, isLoading, isUpdating } = useSettings();
  const savedValue = getSetting(key);
  const [localValue, setLocalValue] = useState(savedValue);
  const [isDirty, setIsDirty] = useState(false);

  // Sync local value when saved value changes (initial load)
  useEffect(() => {
    if (!isDirty) {
      setLocalValue(savedValue);
    }
  }, [savedValue, isDirty]);

  const handleChange = (value: string) => {
    setLocalValue(value);
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (isDirty && localValue !== savedValue) {
      await updateSetting(key, localValue);
      setIsDirty(false);
    }
  };

  return {
    value: localValue,
    savedValue,
    onChange: handleChange,
    onSave: handleSave,
    isLoading,
    isUpdating,
    isDirty,
  };
}
