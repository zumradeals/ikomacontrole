/**
 * Playbook Governance Hooks
 * 
 * React Query hooks for local playbook management with:
 * - Templates (marketplace)
 * - Versioning
 * - Reviews workflow
 * - Executions audit trail
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { Json } from '@/integrations/supabase/types';

// ============================================
// Types
// ============================================

export interface LocalPlaybook {
  id: string;
  key: string;
  title: string;
  description: string | null;
  category: string;
  runtime: 'bash' | 'python' | 'node';
  entrypoint: string;
  schema: Record<string, unknown>;
  timeout_sec: number;
  workdir: string | null;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  effects: string[];
  requirements: string[];
  visibility: string;
  status: 'draft' | 'pending_review' | 'approved' | 'staging_test' | 'published' | 'rejected' | 'test_failed' | 'archived';
  current_version: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlaybookVersion {
  id: string;
  playbook_id: string;
  version: number;
  title: string;
  description: string | null;
  runtime: 'bash' | 'python' | 'node';
  entrypoint: string;
  schema: Record<string, unknown>;
  timeout_sec: number;
  workdir: string | null;
  risk_level: 'low' | 'medium' | 'high' | 'critical' | null;
  effects: string[];
  requirements: string[];
  changelog: string | null;
  diff_from_previous: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
}

export interface PlaybookTemplate {
  id: string;
  key: string;
  title: string;
  description: string | null;
  category: string;
  runtime: 'bash' | 'python' | 'node';
  entrypoint_template: string;
  schema: Record<string, unknown>;
  default_config: Record<string, unknown>;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  effects: string[];
  requirements: string[];
  icon: string | null;
  tags: string[];
  usage_count: number;
  rating_avg: number;
  rating_count: number;
  is_official: boolean;
  created_at: string;
}

export interface PlaybookReview {
  id: string;
  playbook_id: string;
  version: number;
  reviewer_id: string | null;
  status: 'pending' | 'approved' | 'rejected';
  comments: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface PlaybookExecution {
  id: string;
  playbook_id: string | null;
  playbook_key: string;
  playbook_version: number | null;
  order_id: string | null;
  infrastructure_id: string | null;
  runner_id: string | null;
  input_params: Record<string, unknown>;
  status: string;
  exit_code: number | null;
  stdout_tail: string | null;
  stderr_tail: string | null;
  duration_ms: number | null;
  error_message: string | null;
  executed_by: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface CreatePlaybookInput {
  key: string;
  title: string;
  description?: string;
  category?: string;
  runtime: 'bash' | 'python' | 'node';
  entrypoint: string;
  schema?: Record<string, unknown>;
  timeout_sec?: number;
  workdir?: string;
  risk_level?: 'low' | 'medium' | 'high' | 'critical';
  effects?: string[];
  requirements?: string[];
  visibility?: string;
  status?: LocalPlaybook['status'];
}

// ============================================
// Query Keys
// ============================================

export const playbookGovernanceKeys = {
  all: ['playbook-governance'] as const,
  local: () => [...playbookGovernanceKeys.all, 'local'] as const,
  localDetail: (id: string) => [...playbookGovernanceKeys.local(), id] as const,
  versions: (playbookId: string) => [...playbookGovernanceKeys.all, 'versions', playbookId] as const,
  templates: () => [...playbookGovernanceKeys.all, 'templates'] as const,
  reviews: (playbookId?: string) => [...playbookGovernanceKeys.all, 'reviews', playbookId] as const,
  executions: (playbookId?: string) => [...playbookGovernanceKeys.all, 'executions', playbookId] as const,
};

// ============================================
// Local Playbooks CRUD
// ============================================

/**
 * Fetch all local playbooks
 */
export function useLocalPlaybooksList() {
  return useQuery({
    queryKey: playbookGovernanceKeys.local(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('playbooks')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []).map(mapPlaybook);
    },
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Fetch single playbook with versions
 */
export function useLocalPlaybookDetail(id: string | undefined) {
  return useQuery({
    queryKey: playbookGovernanceKeys.localDetail(id || ''),
    queryFn: async () => {
      if (!id) throw new Error('ID required');
      
      const { data, error } = await supabase
        .from('playbooks')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return mapPlaybook(data);
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Local playbooks mutations
 */
export function useLocalPlaybooks() {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (input: CreatePlaybookInput) => {
      const { data, error } = await supabase
        .from('playbooks')
        .insert({
          key: input.key,
          title: input.title,
          description: input.description,
          category: input.category || 'custom',
          runtime: input.runtime,
          entrypoint: input.entrypoint,
          schema: (input.schema || {}) as Json,
          timeout_sec: input.timeout_sec || 300,
          workdir: input.workdir,
          risk_level: input.risk_level || 'medium',
          effects: input.effects || [],
          requirements: input.requirements || [],
          visibility: input.visibility || 'private',
          status: input.status || 'draft',
        })
        .select()
        .single();
      
      if (error) throw error;
      return mapPlaybook(data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: playbookGovernanceKeys.local() });
      toast({
        title: 'Playbook créé',
        description: `${data.title} a été créé avec succès`,
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

  const updateMutation = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<CreatePlaybookInput> }) => {
      const updateData: Record<string, unknown> = {};
      if (input.title !== undefined) updateData.title = input.title;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.category !== undefined) updateData.category = input.category;
      if (input.runtime !== undefined) updateData.runtime = input.runtime;
      if (input.entrypoint !== undefined) updateData.entrypoint = input.entrypoint;
      if (input.schema !== undefined) updateData.schema = input.schema;
      if (input.timeout_sec !== undefined) updateData.timeout_sec = input.timeout_sec;
      if (input.workdir !== undefined) updateData.workdir = input.workdir;
      if (input.risk_level !== undefined) updateData.risk_level = input.risk_level;
      if (input.effects !== undefined) updateData.effects = input.effects;
      if (input.requirements !== undefined) updateData.requirements = input.requirements;
      if (input.visibility !== undefined) updateData.visibility = input.visibility;
      if (input.status !== undefined) updateData.status = input.status;

      const { data, error } = await supabase
        .from('playbooks')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return mapPlaybook(data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: playbookGovernanceKeys.local() });
      queryClient.invalidateQueries({ queryKey: playbookGovernanceKeys.localDetail(data.id) });
      toast({
        title: 'Playbook mis à jour',
        description: `${data.title} a été modifié`,
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

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('playbooks')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: playbookGovernanceKeys.local() });
      toast({
        title: 'Playbook supprimé',
        description: 'Le playbook a été supprimé',
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

  return { createMutation, updateMutation, deleteMutation };
}

// ============================================
// Versioning
// ============================================

/**
 * Fetch versions for a playbook
 */
export function usePlaybookVersions(playbookId: string | undefined) {
  return useQuery({
    queryKey: playbookGovernanceKeys.versions(playbookId || ''),
    queryFn: async () => {
      if (!playbookId) throw new Error('Playbook ID required');
      
      const { data, error } = await supabase
        .from('playbook_versions')
        .select('*')
        .eq('playbook_id', playbookId)
        .order('version', { ascending: false });
      
      if (error) throw error;
      return (data || []).map(mapVersion);
    },
    enabled: !!playbookId,
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Create a new version
 */
export function useCreatePlaybookVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      playbookId, 
      changelog 
    }: { 
      playbookId: string; 
      changelog: string;
    }) => {
      // Get current playbook data
      const { data: playbook, error: fetchError } = await supabase
        .from('playbooks')
        .select('*')
        .eq('id', playbookId)
        .single();
      
      if (fetchError) throw fetchError;
      
      const newVersion = (playbook.current_version || 1) + 1;
      
      // Create version snapshot
      const { data, error } = await supabase
        .from('playbook_versions')
        .insert({
          playbook_id: playbookId,
          version: newVersion,
          title: playbook.title,
          description: playbook.description,
          runtime: playbook.runtime,
          entrypoint: playbook.entrypoint,
          schema: playbook.schema,
          timeout_sec: playbook.timeout_sec,
          workdir: playbook.workdir,
          risk_level: playbook.risk_level,
          effects: playbook.effects,
          requirements: playbook.requirements,
          changelog,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Update playbook version number
      await supabase
        .from('playbooks')
        .update({ current_version: newVersion })
        .eq('id', playbookId);
      
      return mapVersion(data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: playbookGovernanceKeys.versions(data.playbook_id) });
      queryClient.invalidateQueries({ queryKey: playbookGovernanceKeys.local() });
      toast({
        title: 'Nouvelle version créée',
        description: `Version ${data.version} enregistrée`,
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
 * Rollback to a specific version
 */
export function useRollbackPlaybook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      playbookId, 
      versionId 
    }: { 
      playbookId: string; 
      versionId: string;
    }) => {
      // Get version data
      const { data: version, error: fetchError } = await supabase
        .from('playbook_versions')
        .select('*')
        .eq('id', versionId)
        .single();
      
      if (fetchError) throw fetchError;
      
      // Update playbook with version data
      const { data, error } = await supabase
        .from('playbooks')
        .update({
          title: version.title,
          description: version.description,
          runtime: version.runtime,
          entrypoint: version.entrypoint,
          schema: version.schema,
          timeout_sec: version.timeout_sec,
          workdir: version.workdir,
          risk_level: version.risk_level,
          effects: version.effects,
          requirements: version.requirements,
        })
        .eq('id', playbookId)
        .select()
        .single();
      
      if (error) throw error;
      return mapPlaybook(data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: playbookGovernanceKeys.local() });
      queryClient.invalidateQueries({ queryKey: playbookGovernanceKeys.localDetail(data.id) });
      toast({
        title: 'Rollback effectué',
        description: `${data.title} a été restauré`,
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

// ============================================
// Templates (Marketplace)
// ============================================

export function usePlaybookTemplates() {
  return useQuery({
    queryKey: playbookGovernanceKeys.templates(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('playbook_templates')
        .select('*')
        .order('usage_count', { ascending: false });
      
      if (error) throw error;
      return (data || []).map(mapTemplate);
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ============================================
// Reviews Workflow
// ============================================

export function usePlaybookReviews(playbookId?: string) {
  return useQuery({
    queryKey: playbookGovernanceKeys.reviews(playbookId),
    queryFn: async () => {
      let query = supabase
        .from('playbook_reviews')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (playbookId) {
        query = query.eq('playbook_id', playbookId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as PlaybookReview[];
    },
    staleTime: 1 * 60 * 1000,
  });
}

export function useSubmitReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      reviewId, 
      status, 
      comments 
    }: { 
      reviewId: string; 
      status: 'approved' | 'rejected'; 
      comments?: string;
    }) => {
      const { data: review, error: fetchError } = await supabase
        .from('playbook_reviews')
        .update({
          status,
          comments,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', reviewId)
        .select()
        .single();
      
      if (fetchError) throw fetchError;
      
      // Update playbook status based on review
      const newStatus = status === 'approved' ? 'approved' : 'rejected';
      await supabase
        .from('playbooks')
        .update({ status: newStatus })
        .eq('id', review.playbook_id);
      
      return review as PlaybookReview;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: playbookGovernanceKeys.reviews() });
      queryClient.invalidateQueries({ queryKey: playbookGovernanceKeys.local() });
      toast({
        title: data.status === 'approved' ? 'Approuvé' : 'Rejeté',
        description: `Le playbook a été ${data.status === 'approved' ? 'approuvé' : 'rejeté'}`,
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

// ============================================
// Executions Audit Trail
// ============================================

export function usePlaybookExecutions(playbookId?: string) {
  return useQuery({
    queryKey: playbookGovernanceKeys.executions(playbookId),
    queryFn: async () => {
      let query = supabase
        .from('playbook_executions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (playbookId) {
        query = query.eq('playbook_id', playbookId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(mapExecution);
    },
    staleTime: 30 * 1000,
  });
}

export function useRecordExecution() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      playbookId?: string;
      playbookKey: string;
      playbookVersion?: number;
      orderId?: string;
      infrastructureId?: string;
      runnerId?: string;
      inputParams?: Record<string, unknown>;
    }) => {
      const { data, error } = await supabase
        .from('playbook_executions')
        .insert({
          playbook_id: input.playbookId,
          playbook_key: input.playbookKey,
          playbook_version: input.playbookVersion,
          order_id: input.orderId,
          infrastructure_id: input.infrastructureId,
          runner_id: input.runnerId,
          input_params: (input.inputParams || {}) as Json,
          status: 'pending',
          started_at: new Date().toISOString(),
        })
        .select()
        .single();
      
      if (error) throw error;
      return mapExecution(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: playbookGovernanceKeys.executions() });
    },
  });
}

// ============================================
// Mappers
// ============================================

function mapPlaybook(raw: Record<string, unknown>): LocalPlaybook {
  return {
    id: raw.id as string,
    key: raw.key as string,
    title: raw.title as string,
    description: raw.description as string | null,
    category: raw.category as string,
    runtime: raw.runtime as LocalPlaybook['runtime'],
    entrypoint: raw.entrypoint as string,
    schema: (raw.schema as Record<string, unknown>) || {},
    timeout_sec: raw.timeout_sec as number,
    workdir: raw.workdir as string | null,
    risk_level: raw.risk_level as LocalPlaybook['risk_level'],
    effects: (raw.effects as string[]) || [],
    requirements: (raw.requirements as string[]) || [],
    visibility: raw.visibility as string,
    status: raw.status as LocalPlaybook['status'],
    current_version: raw.current_version as number,
    created_by: raw.created_by as string | null,
    created_at: raw.created_at as string,
    updated_at: raw.updated_at as string,
  };
}

function mapVersion(raw: Record<string, unknown>): PlaybookVersion {
  return {
    id: raw.id as string,
    playbook_id: raw.playbook_id as string,
    version: raw.version as number,
    title: raw.title as string,
    description: raw.description as string | null,
    runtime: raw.runtime as PlaybookVersion['runtime'],
    entrypoint: raw.entrypoint as string,
    schema: (raw.schema as Record<string, unknown>) || {},
    timeout_sec: raw.timeout_sec as number,
    workdir: raw.workdir as string | null,
    risk_level: raw.risk_level as PlaybookVersion['risk_level'],
    effects: (raw.effects as string[]) || [],
    requirements: (raw.requirements as string[]) || [],
    changelog: raw.changelog as string | null,
    diff_from_previous: raw.diff_from_previous as Record<string, unknown> | null,
    created_by: raw.created_by as string | null,
    created_at: raw.created_at as string,
  };
}

function mapTemplate(raw: Record<string, unknown>): PlaybookTemplate {
  return {
    id: raw.id as string,
    key: raw.key as string,
    title: raw.title as string,
    description: raw.description as string | null,
    category: raw.category as string,
    runtime: raw.runtime as PlaybookTemplate['runtime'],
    entrypoint_template: raw.entrypoint_template as string,
    schema: (raw.schema as Record<string, unknown>) || {},
    default_config: (raw.default_config as Record<string, unknown>) || {},
    risk_level: raw.risk_level as PlaybookTemplate['risk_level'],
    effects: (raw.effects as string[]) || [],
    requirements: (raw.requirements as string[]) || [],
    icon: raw.icon as string | null,
    tags: (raw.tags as string[]) || [],
    usage_count: raw.usage_count as number,
    rating_avg: Number(raw.rating_avg) || 0,
    rating_count: raw.rating_count as number,
    is_official: raw.is_official as boolean,
    created_at: raw.created_at as string,
  };
}

function mapExecution(raw: Record<string, unknown>): PlaybookExecution {
  return {
    id: raw.id as string,
    playbook_id: raw.playbook_id as string | null,
    playbook_key: raw.playbook_key as string,
    playbook_version: raw.playbook_version as number | null,
    order_id: raw.order_id as string | null,
    infrastructure_id: raw.infrastructure_id as string | null,
    runner_id: raw.runner_id as string | null,
    input_params: (raw.input_params as Record<string, unknown>) || {},
    status: raw.status as string,
    exit_code: raw.exit_code as number | null,
    stdout_tail: raw.stdout_tail as string | null,
    stderr_tail: raw.stderr_tail as string | null,
    duration_ms: raw.duration_ms as number | null,
    error_message: raw.error_message as string | null,
    executed_by: raw.executed_by as string | null,
    started_at: raw.started_at as string | null,
    completed_at: raw.completed_at as string | null,
    created_at: raw.created_at as string,
  };
}
