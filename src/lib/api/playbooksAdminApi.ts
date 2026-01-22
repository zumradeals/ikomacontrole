/**
 * Playbooks Admin API Client
 * 
 * CRUD operations for playbooks via admin-proxy
 * Endpoints:
 * - POST /admin/playbooks - Create playbook
 * - GET /admin/playbooks - List playbooks (admin view with full details)
 * - GET /admin/playbooks/:key - Get playbook detail
 * - PUT /admin/playbooks/:key - Update playbook
 * - DELETE /admin/playbooks/:key - Delete playbook
 * - POST /admin/scripts/scan - Scan server for available scripts
 */

import { supabase } from '@/integrations/supabase/client';

// ============================================
// Types
// ============================================

export interface PlaybookSchema {
  type: 'object';
  properties: Record<string, {
    type: string;
    description?: string;
    default?: unknown;
    enum?: string[];
  }>;
  required?: string[];
}

export interface PlaybookRuntime {
  type: 'bash' | 'python' | 'node';
  version?: string;
}

export interface PlaybookDefinition {
  key: string;
  title: string;
  description: string;
  version: string;
  visibility: 'internal' | 'public';
  actions: string[];
  schema: PlaybookSchema;
  runtime: PlaybookRuntime;
  entrypoint: string;
  timeoutSec: number;
  workdir?: string;
  category?: string;
  riskLevel?: 'low' | 'medium' | 'high';
  examples?: PlaybookExample[];
  effects?: string[];
  requirements?: string[];
}

export interface PlaybookExample {
  name: string;
  description?: string;
  input: Record<string, unknown>;
}

export interface CreatePlaybookInput {
  key: string;
  title: string;
  description: string;
  runtime: PlaybookRuntime;
  entrypoint: string;
  timeoutSec?: number;
  workdir?: string;
  schema?: PlaybookSchema;
  visibility?: 'internal' | 'public';
  actions?: string[];
  category?: string;
  riskLevel?: 'low' | 'medium' | 'high';
  examples?: PlaybookExample[];
  effects?: string[];
  requirements?: string[];
}

export interface UpdatePlaybookInput {
  title?: string;
  description?: string;
  runtime?: PlaybookRuntime;
  entrypoint?: string;
  timeoutSec?: number;
  workdir?: string;
  schema?: PlaybookSchema;
  visibility?: 'internal' | 'public';
  actions?: string[];
  category?: string;
  riskLevel?: 'low' | 'medium' | 'high';
  examples?: PlaybookExample[];
  effects?: string[];
  requirements?: string[];
}

export interface ScriptInfo {
  path: string;
  name: string;
  runtime: 'bash' | 'python' | 'node' | 'unknown';
  size: number;
  modifiedAt: string;
}

export interface ApiResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  requestId?: string;
}

// ============================================
// API Request Helper
// ============================================

async function adminRequest<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: Record<string, unknown>
): Promise<ApiResult<T>> {
  try {
    const { data, error } = await supabase.functions.invoke('admin-proxy', {
      body: { method, path, body },
    });

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    // Check for proxy-level errors
    const proxyStatus = data?.proxy_status;
    if (proxyStatus && proxyStatus >= 400) {
      return {
        success: false,
        error: data?.error || data?.message || `API returned ${proxyStatus}`,
        requestId: data?.requestId,
      };
    }

    if (data?.error) {
      return {
        success: false,
        error: data.error,
        requestId: data?.requestId,
      };
    }

    return {
      success: true,
      data: data as T,
      requestId: data?.requestId,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Network error',
    };
  }
}

// ============================================
// Playbook CRUD Operations
// ============================================

/**
 * POST /admin/playbooks - Create a new playbook
 */
export async function createPlaybook(input: CreatePlaybookInput): Promise<ApiResult<PlaybookDefinition>> {
  const result = await adminRequest<any>('POST', '/admin/playbooks', {
    key: input.key,
    title: input.title,
    description: input.description,
    runtime: input.runtime,
    entrypoint: input.entrypoint,
    timeoutSec: input.timeoutSec ?? 300,
    workdir: input.workdir,
    schema: input.schema ?? { type: 'object', properties: {}, required: [] },
    visibility: input.visibility ?? 'internal',
    actions: input.actions ?? ['run'],
    category: input.category,
    riskLevel: input.riskLevel ?? 'medium',
    examples: input.examples,
    effects: input.effects,
    requirements: input.requirements,
  });

  if (!result.success) {
    return result as ApiResult<PlaybookDefinition>;
  }

  return {
    success: true,
    data: mapPlaybook(result.data?.playbook || result.data),
    requestId: result.requestId,
  };
}

/**
 * GET /admin/playbooks - List all playbooks with full admin details
 */
export async function listAdminPlaybooks(): Promise<ApiResult<PlaybookDefinition[]>> {
  const result = await adminRequest<any>('GET', '/admin/playbooks');

  if (!result.success) {
    return result as ApiResult<PlaybookDefinition[]>;
  }

  // Handle both { items: [...] } and raw array formats
  const rawPlaybooks = result.data?.items || result.data || [];
  const playbooks = Array.isArray(rawPlaybooks) 
    ? rawPlaybooks.map(mapPlaybook)
    : [];

  return {
    success: true,
    data: playbooks,
    requestId: result.requestId,
  };
}

/**
 * GET /admin/playbooks/:key - Get playbook detail
 */
export async function getPlaybook(key: string): Promise<ApiResult<PlaybookDefinition>> {
  const result = await adminRequest<any>('GET', `/admin/playbooks/${encodeURIComponent(key)}`);

  if (!result.success) {
    return result as ApiResult<PlaybookDefinition>;
  }

  return {
    success: true,
    data: mapPlaybook(result.data?.playbook || result.data),
    requestId: result.requestId,
  };
}

/**
 * PUT /admin/playbooks/:key - Update playbook
 */
export async function updatePlaybook(
  key: string,
  input: UpdatePlaybookInput
): Promise<ApiResult<PlaybookDefinition>> {
  const result = await adminRequest<any>('PUT', `/admin/playbooks/${encodeURIComponent(key)}`, input as unknown as Record<string, unknown>);

  if (!result.success) {
    return result as ApiResult<PlaybookDefinition>;
  }

  return {
    success: true,
    data: mapPlaybook(result.data?.playbook || result.data),
    requestId: result.requestId,
  };
}

/**
 * DELETE /admin/playbooks/:key - Delete playbook
 */
export async function deletePlaybook(key: string): Promise<ApiResult<void>> {
  const result = await adminRequest<any>('DELETE', `/admin/playbooks/${encodeURIComponent(key)}`);

  if (!result.success) {
    return result as ApiResult<void>;
  }

  return {
    success: true,
    requestId: result.requestId,
  };
}

// ============================================
// Script Scanning
// ============================================

/**
 * POST /admin/scripts/scan - Scan server for available scripts
 */
export async function scanScripts(serverId: string): Promise<ApiResult<ScriptInfo[]>> {
  const result = await adminRequest<any>('POST', '/admin/scripts/scan', { serverId });

  if (!result.success) {
    return result as ApiResult<ScriptInfo[]>;
  }

  const scripts = result.data?.scripts || result.data?.items || result.data || [];
  return {
    success: true,
    data: Array.isArray(scripts) ? scripts.map(mapScript) : [],
    requestId: result.requestId,
  };
}

// ============================================
// Data Mapping
// ============================================

function mapPlaybook(raw: any): PlaybookDefinition {
  return {
    key: raw.key,
    title: raw.title || raw.name || raw.key,
    description: raw.description || '',
    version: raw.version || raw.schemaVersion || '1.0',
    visibility: raw.visibility || (raw.isPublished ? 'public' : 'internal'),
    actions: raw.actions || ['run'],
    schema: raw.schema || { type: 'object', properties: {}, required: [] },
    runtime: raw.runtime || { type: 'bash' },
    entrypoint: raw.entrypoint || '',
    timeoutSec: raw.timeoutSec || raw.timeout_sec || 300,
    workdir: raw.workdir || raw.work_dir,
    category: raw.category,
    riskLevel: raw.riskLevel || raw.risk_level || 'medium',
    examples: raw.examples || [],
    effects: raw.effects || [],
    requirements: raw.requirements || [],
  };
}

function mapScript(raw: any): ScriptInfo {
  return {
    path: raw.path,
    name: raw.name || raw.path?.split('/').pop() || 'unknown',
    runtime: detectRuntime(raw.path || raw.name),
    size: raw.size || 0,
    modifiedAt: raw.modifiedAt || raw.modified_at || new Date().toISOString(),
  };
}

function detectRuntime(path: string): ScriptInfo['runtime'] {
  if (path.endsWith('.sh') || path.endsWith('.bash')) return 'bash';
  if (path.endsWith('.py')) return 'python';
  if (path.endsWith('.js') || path.endsWith('.ts')) return 'node';
  return 'unknown';
}
