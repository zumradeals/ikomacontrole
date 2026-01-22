/**
 * Hook pour récupérer les playbooks depuis l'API IKOMA
 * Source de vérité unique : GET /v1/admin/playbooks
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ============================================
// Types - Contrat API Playbooks
// ============================================

export interface PlaybookSchema {
  type: 'object';
  properties: Record<string, {
    type: string;
    description?: string;
  }>;
  required?: string[];
}

export interface PlaybookItem {
  key: string;
  version: string;
  title: string;
  description: string;
  visibility: 'internal' | 'public';
  actions: string[];
  schema: PlaybookSchema;
}

export interface PlaybooksResponse {
  items: PlaybookItem[];
}

// ============================================
// API Call
// ============================================

async function fetchPlaybooks(): Promise<PlaybookItem[]> {
  const { data, error } = await supabase.functions.invoke('admin-proxy', {
    body: {
      method: 'GET',
      path: '/admin/playbooks',
    },
  });

  if (error) {
    console.error('[usePlaybooks] Edge function error:', error);
    throw new Error(error.message || 'Erreur lors du chargement des playbooks');
  }

  // Handle proxy errors
  if (data?.error) {
    console.error('[usePlaybooks] API error:', data.error);
    throw new Error(data.error);
  }

  // Extract items from response
  const items = data?.items || [];
  console.info(`[usePlaybooks] Loaded ${items.length} playbooks from API`);
  
  return items;
}

// ============================================
// React Query Hook
// ============================================

export function usePlaybooks() {
  return useQuery({
    queryKey: ['playbooks'],
    queryFn: fetchPlaybooks,
    staleTime: 5 * 60 * 1000, // 5 minutes - playbooks don't change often
    gcTime: 30 * 60 * 1000, // 30 minutes cache
    retry: 2,
  });
}

// ============================================
// Helper to get playbook by key
// ============================================

export function usePlaybook(key: string) {
  const { data: playbooks, ...rest } = usePlaybooks();
  
  const playbook = playbooks?.find(p => p.key === key);
  
  return {
    playbook,
    ...rest,
  };
}
