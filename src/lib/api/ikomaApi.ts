/**
 * IKOMA Engine API Client
 * 
 * Aligné sur les endpoints réels du moteur IKOMA:
 * - Base URLs: http://127.0.0.1:3000 (dev) / https://api.ikomadigit.com (prod)
 * - Auth: x-ikoma-admin-key header
 */

import { supabase } from '@/integrations/supabase/client';

// ============================================
// Types - Report Contract v1
// ============================================

export interface ReportV1Step {
  name: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED';
  ok?: boolean;
  durationMs?: number;
  stdout?: string;
  stderr?: string;
  error?: string;
}

export interface ReportV1Artifacts {
  public: Record<string, string | number | boolean>;
  internal: Record<string, unknown>;
}

export interface ReportV1Error {
  code: string;
  message: string;
  context?: Record<string, unknown>;
}

export interface ReportV1 {
  version: string;
  ok: boolean;
  summary: string;
  steps: ReportV1Step[];
  artifacts: ReportV1Artifacts;
  errors: ReportV1Error[];
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
}

export interface IkomaOrder {
  id: string;
  serverId: string;
  runnerId?: string;
  playbookKey: string;
  action: string;
  status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  report?: ReportV1;
  requestId?: string;
}

export interface ApiError {
  type: 'NOT_FOUND' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'SERVER_ERROR' | 'NETWORK_ERROR' | 'UNKNOWN';
  message: string;
  statusCode?: number;
  requestId?: string;
}

export interface ApiResult<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  requestId?: string;
}

// ============================================
// Playbooks (liste statique minimale)
// ============================================

export const STATIC_PLAYBOOKS = [
  { key: 'SYSTEM.diagnostics', name: 'System Diagnostics', description: 'Run comprehensive system diagnostics' },
  { key: 'SYSTEM.heartbeat', name: 'Heartbeat Check', description: 'Quick connectivity test' },
  { key: 'system.test_ping', name: 'Test de connectivité', description: 'Simple ping test' },
];

// ============================================
// Error Handling
// ============================================

function parseApiError(statusCode: number, responseData: any): ApiError {
  const requestId = responseData?.requestId;
  
  if (statusCode === 404) {
    return {
      type: 'NOT_FOUND',
      message: 'Endpoint non trouvé — vérifier baseURL et version API',
      statusCode,
      requestId,
    };
  }
  
  if (statusCode === 401) {
    return {
      type: 'UNAUTHORIZED',
      message: 'Admin key invalide ou manquante',
      statusCode,
      requestId,
    };
  }
  
  if (statusCode === 403) {
    return {
      type: 'FORBIDDEN',
      message: 'Accès refusé — vérifier les permissions',
      statusCode,
      requestId,
    };
  }
  
  if (statusCode >= 500) {
    return {
      type: 'SERVER_ERROR',
      message: responseData?.error || responseData?.message || 'Erreur serveur interne',
      statusCode,
      requestId,
    };
  }
  
  return {
    type: 'UNKNOWN',
    message: responseData?.error || responseData?.message || `Erreur HTTP ${statusCode}`,
    statusCode,
    requestId,
  };
}

// ============================================
// Core Request via Edge Function
// ============================================

interface IkomaRequest {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  body?: Record<string, unknown>;
}

async function ikomaRequest<T>(request: IkomaRequest): Promise<ApiResult<T>> {
  try {
    const { data, error } = await supabase.functions.invoke('admin-proxy', {
      body: {
        method: request.method,
        path: request.path,
        body: request.body,
      },
    });

    if (error) {
      return {
        success: false,
        error: {
          type: 'NETWORK_ERROR',
          message: error.message,
        },
      };
    }

    // Check for proxy-level errors
    const proxyStatus = data?.proxy_status;
    if (proxyStatus && proxyStatus >= 400) {
      return {
        success: false,
        error: parseApiError(proxyStatus, data),
        requestId: data?.requestId,
      };
    }

    // Check for error field in response
    if (data?.error) {
      return {
        success: false,
        error: parseApiError(data.proxy_status || 400, data),
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
      error: {
        type: 'NETWORK_ERROR',
        message: err instanceof Error ? err.message : 'Erreur réseau',
      },
    };
  }
}

// ============================================
// API Methods
// ============================================

/**
 * GET /health - Vérifier la santé de l'API
 */
export async function checkHealth(): Promise<ApiResult<{ status: string; version?: string }>> {
  // Use public-proxy for unauthenticated health check
  try {
    const { data, error } = await supabase.functions.invoke('public-proxy', {
      body: { path: '/health' },
    });
    
    if (error) {
      return { success: false, error: { type: 'NETWORK_ERROR', message: error.message } };
    }
    
    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: { type: 'NETWORK_ERROR', message: err instanceof Error ? err.message : 'Network error' },
    };
  }
}

/**
 * POST /v1/orders - Créer un ordre
 */
export async function createOrder(params: {
  serverId: string;
  playbookKey: string;
  action: string;
  createdBy: string;
  params?: Record<string, unknown>;
}): Promise<ApiResult<IkomaOrder>> {
  const idempotencyKey = `${params.serverId}-${params.playbookKey}-${Date.now()}`;
  
  const result = await ikomaRequest<any>({
    method: 'POST',
    path: '/orders',
    body: {
      serverId: params.serverId,
      playbookKey: params.playbookKey,
      action: params.action,
      idempotencyKey,
      createdBy: params.createdBy,
      params: params.params,
    },
  });

  if (!result.success) {
    return result as ApiResult<IkomaOrder>;
  }

  const orderData = result.data?.order || result.data;
  return {
    success: true,
    data: mapOrder(orderData),
    requestId: result.requestId,
  };
}

/**
 * GET /v1/orders/:id - Récupérer un ordre
 */
export async function getOrder(orderId: string): Promise<ApiResult<IkomaOrder>> {
  const result = await ikomaRequest<any>({
    method: 'GET',
    path: `/orders/${orderId}`,
  });

  if (!result.success) {
    return result as ApiResult<IkomaOrder>;
  }

  const orderData = result.data?.order || result.data;
  return {
    success: true,
    data: mapOrder(orderData),
    requestId: result.requestId,
  };
}

/**
 * GET /v1/orders - Lister les ordres
 */
export async function listOrders(serverId?: string): Promise<ApiResult<IkomaOrder[]>> {
  const path = serverId ? `/orders?serverId=${serverId}` : '/orders';
  
  const result = await ikomaRequest<any>({
    method: 'GET',
    path,
  });

  if (!result.success) {
    return result as ApiResult<IkomaOrder[]>;
  }

  const rawOrders = Array.isArray(result.data) 
    ? result.data 
    : result.data?.orders || [];

  return {
    success: true,
    data: rawOrders.map(mapOrder),
    requestId: result.requestId,
  };
}

/**
 * POST /v1/orders/system.diagnostics - Lancer les diagnostics
 */
export async function runDiagnostics(serverId: string, createdBy = 'ui'): Promise<ApiResult<IkomaOrder>> {
  const result = await ikomaRequest<any>({
    method: 'POST',
    path: '/orders/system.diagnostics',
    body: {
      serverId,
      createdBy,
    },
  });

  if (!result.success) {
    return result as ApiResult<IkomaOrder>;
  }

  const orderData = result.data?.order || result.data;
  return {
    success: true,
    data: mapOrder(orderData),
    requestId: result.requestId,
  };
}

// ============================================
// Data Mapping
// ============================================

function mapOrder(raw: any): IkomaOrder {
  const rawReport = raw.report;
  
  return {
    id: raw.id,
    serverId: raw.server_id ?? raw.serverId,
    runnerId: raw.runner_id ?? raw.runnerId,
    playbookKey: raw.playbook_key ?? raw.playbookKey,
    action: raw.action,
    status: raw.status?.toUpperCase?.() || raw.status || 'QUEUED',
    createdAt: raw.created_at ?? raw.createdAt ?? new Date().toISOString(),
    startedAt: raw.started_at ?? raw.startedAt,
    completedAt: raw.completed_at ?? raw.completedAt,
    report: rawReport ? mapReport(rawReport) : undefined,
    requestId: raw.requestId,
  };
}

function mapReport(raw: any): ReportV1 {
  return {
    version: raw.version ?? 'v1',
    ok: raw.ok ?? false,
    summary: raw.summary ?? '',
    steps: (raw.steps || []).map((s: any) => ({
      name: s.name ?? s.key ?? 'unknown',
      status: normalizeStepStatus(s),
      ok: s.ok,
      durationMs: s.durationMs,
      stdout: s.stdout ?? s.output,
      stderr: s.stderr,
      error: s.error,
    })),
    artifacts: {
      public: raw.artifacts?.public ?? {},
      internal: raw.artifacts?.internal ?? {},
    },
    errors: (raw.errors || []).map((e: any) => ({
      code: e.code ?? 'UNKNOWN',
      message: e.message ?? String(e),
      context: e.context,
    })),
    startedAt: raw.startedAt,
    finishedAt: raw.finishedAt,
    durationMs: raw.durationMs ?? calculateDuration(raw.startedAt, raw.finishedAt),
  };
}

function normalizeStepStatus(step: any): ReportV1Step['status'] {
  if (step.status) {
    return step.status.toUpperCase();
  }
  if (step.ok === true) return 'SUCCESS';
  if (step.ok === false) return 'FAILED';
  return 'PENDING';
}

function calculateDuration(start?: string, end?: string): number | undefined {
  if (!start || !end) return undefined;
  return new Date(end).getTime() - new Date(start).getTime();
}
