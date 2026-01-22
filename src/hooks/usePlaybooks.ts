/**
 * Hook pour récupérer les playbooks depuis l'API IKOMA
 * Source de vérité unique : GET /v1/playbooks
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ============================================
// Types - Contrat API Playbooks (normalisé)
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
  // Original API fields for reference
  category?: string;
  riskLevel?: string;
}

export interface PlaybooksResponse {
  items: PlaybookItem[];
}

// ============================================
// API Response Type (raw from backend)
// ============================================

interface RawPlaybook {
  id?: string;
  key: string;
  name?: string;
  title?: string;
  description?: string;
  category?: string;
  riskLevel?: string;
  isPublished?: string | boolean;
  schemaVersion?: string;
  spec?: Record<string, unknown>;
  requiresScopes?: string[];
  createdAt?: string;
  updatedAt?: string;
  // New format fields
  version?: string;
  visibility?: 'internal' | 'public';
  actions?: string[];
  schema?: PlaybookSchema;
}

// ============================================
// Normalization Layer
// ============================================

function normalizePlaybook(raw: RawPlaybook): PlaybookItem {
  // Determine visibility from isPublished or visibility field
  let visibility: 'internal' | 'public' = 'public';
  if (raw.visibility) {
    visibility = raw.visibility;
  } else if (raw.isPublished !== undefined) {
    // isPublished can be string "true"/"false" or boolean
    const isPublished = raw.isPublished === true || raw.isPublished === 'true';
    visibility = isPublished ? 'public' : 'internal';
  }

  // Build description from name or description
  const description = raw.description || raw.name || raw.key;
  
  // Build title from title, name, or key
  const title = raw.title || raw.name || raw.key;

  // Extract actions - default to ['run'] if not specified
  const actions = raw.actions || ['run'];

  // Build schema from spec or schema field
  const schema: PlaybookSchema = raw.schema || {
    type: 'object',
    properties: {},
    required: [],
  };

  return {
    key: raw.key,
    version: raw.version || raw.schemaVersion || '1.0',
    title,
    description,
    visibility,
    actions,
    schema,
    category: raw.category,
    riskLevel: raw.riskLevel,
  };
}

// ============================================
// API Call
// ============================================

async function fetchPlaybooks(): Promise<PlaybookItem[]> {
  const { data, error } = await supabase.functions.invoke('admin-proxy', {
    body: {
      method: 'GET',
      path: '/playbooks',
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

  // Parse response - handle multiple formats:
  // 1. { items: [...] } - standard format
  // 2. { "0": {...}, "1": {...}, proxy_* } - indexed object format
  // 3. [...] - direct array format
  let rawPlaybooks: RawPlaybook[] = [];

  if (Array.isArray(data?.items)) {
    // Standard format with items array
    rawPlaybooks = data.items;
  } else if (Array.isArray(data)) {
    // Direct array format
    rawPlaybooks = data;
  } else if (data && typeof data === 'object') {
    // Indexed object format { "0": {...}, "1": {...}, proxy_* }
    // Filter out proxy metadata keys
    const entries = Object.entries(data).filter(([key]) => 
      !key.startsWith('proxy_') && !isNaN(Number(key))
    );
    rawPlaybooks = entries.map(([, value]) => value as RawPlaybook);
  }

  const items = rawPlaybooks.map(normalizePlaybook);
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
