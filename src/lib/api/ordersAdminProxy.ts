/**
 * Orders Admin Proxy Client
 * 
 * Centralized API client for all admin operations via the secure admin-proxy Edge Function.
 * This ensures:
 * - No direct browser-to-API calls (CORS safety)
 * - Admin key stays server-side
 * - Consistent error handling and logging
 * - Automatic snake_case/camelCase normalization
 */

import { supabase } from '@/integrations/supabase/client';

// ============================================
// Types
// ============================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}

export interface ProxyServer {
  id: string;
  name: string;
  host?: string;
  ip?: string;
  runnerId?: string | null;
  runnerName?: string | null;
  runnerStatus?: string | null;
  status?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ProxyRunner {
  id: string;
  name: string;
  status: string;
  lastHeartbeatAt: string | null;
  infrastructureId: string | null;
  serverId?: string | null; // Alternative field name
  scopes?: string[];
  capabilities?: Record<string, unknown>;
  hostInfo?: {
    hostname?: string;
    os?: string;
    arch?: string;
    cpuCores?: number;
    memoryMb?: number;
  };
  createdAt: string;
}

export interface CreateRunnerResult {
  id: string;
  name: string;
  token: string;
}

export interface AttachResult {
  success: boolean;
  method: 'server-attach' | 'runner-attach' | 'direct' | 'patch';
  message?: string;
}

// Log entry for UI debugging
export interface ProxyLogEntry {
  timestamp: Date;
  action: string;
  endpoint: string;
  method: string;
  statusCode?: number;
  success: boolean;
  error?: string;
  duration?: number;
}

// In-memory log buffer for diagnostics
const proxyLogs: ProxyLogEntry[] = [];
const MAX_LOGS = 50;

function addLog(entry: Omit<ProxyLogEntry, 'timestamp'>) {
  proxyLogs.unshift({ ...entry, timestamp: new Date() });
  if (proxyLogs.length > MAX_LOGS) {
    proxyLogs.pop();
  }
}

export function getProxyLogs(): ProxyLogEntry[] {
  return [...proxyLogs];
}

export function clearProxyLogs(): void {
  proxyLogs.length = 0;
}

// ============================================
// Core Proxy Function
// ============================================

interface ProxyRequest {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  body?: Record<string, unknown>;
}

async function adminProxy<T = unknown>(request: ProxyRequest): Promise<ApiResponse<T>> {
  const startTime = Date.now();
  const logAction = `${request.method} ${request.path}`;
  
  console.log(`[ordersAdminProxy] ${logAction}`, request.body || '');

  try {
    const { data, error } = await supabase.functions.invoke('admin-proxy', {
      body: request,
    });

    const duration = Date.now() - startTime;

    if (error) {
      // Try to extract response body from FunctionsHttpError for status code
      let statusCode: number | undefined;
      let errorMessage = error.message;
      
      // Check if error has context with response data
      if ('context' in error && error.context) {
        try {
          // FunctionsHttpError stores response in context
          const ctx = error.context as { status?: number; body?: string };
          statusCode = ctx.status;
          if (ctx.body) {
            const parsed = JSON.parse(ctx.body);
            errorMessage = parsed.error || parsed.message || errorMessage;
            statusCode = parsed.status || statusCode;
          }
        } catch {
          // Ignore parse errors
        }
      }
      
      console.error(`[ordersAdminProxy] Error (${statusCode || 'unknown'}):`, errorMessage);
      addLog({
        action: logAction,
        endpoint: request.path,
        method: request.method,
        statusCode,
        success: false,
        error: errorMessage,
        duration,
      });
      return { success: false, error: errorMessage, statusCode };
    }

    if (data?.error) {
      console.error(`[ordersAdminProxy] API Error:`, data.error);
      addLog({
        action: logAction,
        endpoint: request.path,
        method: request.method,
        statusCode: data.status || data.statusCode,
        success: false,
        error: data.error,
        duration,
      });
      return { success: false, error: data.error, statusCode: data.status };
    }

    addLog({
      action: logAction,
      endpoint: request.path,
      method: request.method,
      statusCode: 200,
      success: true,
      duration,
    });

    return { success: true, data: data as T, statusCode: 200 };
  } catch (err) {
    const duration = Date.now() - startTime;
    let errorMsg = err instanceof Error ? err.message : 'Unknown error';
    let statusCode: number | undefined;
    
    // Try to extract status from error message pattern "returned 404"
    const statusMatch = errorMsg.match(/returned?\s*(\d{3})/i);
    if (statusMatch) {
      statusCode = parseInt(statusMatch[1], 10);
    }
    
    addLog({
      action: logAction,
      endpoint: request.path,
      method: request.method,
      statusCode,
      success: false,
      error: errorMsg,
      duration,
    });

    return { success: false, error: errorMsg, statusCode };
  }
}

// ============================================
// Data Mappers (snake_case ↔ camelCase)
// ============================================

interface RawRunner {
  id: string;
  name: string;
  status?: string;
  last_heartbeat_at?: string;
  lastHeartbeatAt?: string;
  last_seen_at?: string;
  infrastructure_id?: string | null;
  infrastructureId?: string | null;
  server_id?: string | null;
  serverId?: string | null;
  scopes?: string[];
  capabilities?: Record<string, unknown>;
  host_info?: Record<string, unknown>;
  hostInfo?: Record<string, unknown>;
  created_at?: string;
  createdAt?: string;
}

export function mapRunner(raw: RawRunner): ProxyRunner {
  return {
    id: raw.id,
    name: raw.name,
    status: raw.status || 'unknown',
    lastHeartbeatAt: raw.last_heartbeat_at || raw.lastHeartbeatAt || raw.last_seen_at || null,
    infrastructureId: raw.infrastructure_id ?? raw.infrastructureId ?? raw.server_id ?? raw.serverId ?? null,
    serverId: raw.server_id ?? raw.serverId ?? raw.infrastructure_id ?? raw.infrastructureId ?? null,
    scopes: raw.scopes,
    capabilities: raw.capabilities,
    hostInfo: (raw.host_info || raw.hostInfo) as ProxyRunner['hostInfo'],
    createdAt: raw.created_at || raw.createdAt || new Date().toISOString(),
  };
}

interface RawServer {
  id: string;
  name: string;
  host?: string;
  ip?: string;
  runner_id?: string | null;
  runnerId?: string | null;
  runner?: { id: string; name: string; status: string } | null;
  status?: string;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
}

export function mapServer(raw: RawServer): ProxyServer {
  const runnerId = raw.runner_id ?? raw.runnerId ?? raw.runner?.id ?? null;
  return {
    id: raw.id,
    name: raw.name,
    host: raw.host,
    ip: raw.ip,
    runnerId,
    runnerName: raw.runner?.name ?? null,
    runnerStatus: raw.runner?.status ?? null,
    status: raw.status,
    createdAt: raw.created_at || raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updated_at || raw.updatedAt,
  };
}

// ============================================
// Runner Operations
// ============================================

export async function listRunners(): Promise<ApiResponse<ProxyRunner[]>> {
  const response = await adminProxy<{ runners?: RawRunner[] } | RawRunner[]>({
    method: 'GET',
    path: '/runners',
  });

  if (!response.success || !response.data) {
    return { success: false, error: response.error };
  }

  const rawRunners = Array.isArray(response.data) 
    ? response.data 
    : response.data.runners || [];
  
  return {
    success: true,
    data: rawRunners.map(mapRunner),
  };
}

export async function getRunner(runnerId: string): Promise<ApiResponse<ProxyRunner>> {
  const response = await adminProxy<RawRunner>({
    method: 'GET',
    path: `/runners/${runnerId}`,
  });

  if (!response.success || !response.data) {
    return { 
      success: false, 
      error: response.error,
      statusCode: response.statusCode, // Propagate status code for 404 detection
    };
  }

  return {
    success: true,
    data: mapRunner(response.data),
  };
}

export async function createRunner(
  name: string, 
  infrastructureId?: string
): Promise<ApiResponse<CreateRunnerResult>> {
  return adminProxy<CreateRunnerResult>({
    method: 'POST',
    path: '/runners',
    body: {
      name,
      infrastructureId: infrastructureId || null,
    },
  });
}

export async function resetRunnerToken(runnerId: string): Promise<ApiResponse<{ token: string }>> {
  return adminProxy<{ token: string }>({
    method: 'POST',
    path: `/runners/${runnerId}/token/reset`,
    body: {},
  });
}

export async function deleteRunner(runnerId: string): Promise<ApiResponse<void>> {
  return adminProxy<void>({
    method: 'DELETE',
    path: `/runners/${runnerId}`,
  });
}

// ============================================
// Server/Infrastructure Operations
// ============================================

export async function listServers(): Promise<ApiResponse<ProxyServer[]>> {
  const response = await adminProxy<{ servers?: RawServer[] } | RawServer[]>({
    method: 'GET',
    path: '/servers',
  });

  if (!response.success) {
    console.log('[ordersAdminProxy] /servers endpoint error:', response.error);
    return { success: false, error: response.error, statusCode: response.statusCode };
  }

  if (!response.data) {
    return { success: true, data: [] };
  }

  const rawServers = Array.isArray(response.data)
    ? response.data
    : response.data.servers || [];

  return {
    success: true,
    data: rawServers.map(mapServer),
  };
}

export async function getServer(serverId: string): Promise<ApiResponse<ProxyServer>> {
  const response = await adminProxy<RawServer>({
    method: 'GET',
    path: `/servers/${serverId}`,
  });

  if (!response.success || !response.data) {
    return { success: false, error: response.error, statusCode: response.statusCode };
  }

  return {
    success: true,
    data: mapServer(response.data),
  };
}

/**
 * Create a new server via POST /servers.
 */
export async function createServer(
  name: string,
  baseUrl?: string,
  runnerId?: string | null
): Promise<ApiResponse<ProxyServer>> {
  const body: Record<string, unknown> = { name };
  if (baseUrl) body.baseUrl = baseUrl;
  if (runnerId) body.runnerId = runnerId;

  const response = await adminProxy<RawServer>({
    method: 'POST',
    path: '/servers',
    body,
  });

  if (!response.success || !response.data) {
    return { success: false, error: response.error, statusCode: response.statusCode };
  }

  return {
    success: true,
    data: mapServer(response.data),
  };
}

/**
 * Update server runner association via PATCH /servers/:id.
 * Body: { runnerId: "<id>" | null }
 */
export async function updateServerRunner(
  serverId: string,
  runnerId: string | null
): Promise<ApiResponse<ProxyServer>> {
  const response = await adminProxy<RawServer>({
    method: 'PATCH',
    path: `/servers/${serverId}`,
    body: { runnerId },
  });

  if (!response.success) {
    return { success: false, error: response.error, statusCode: response.statusCode };
  }

  if (response.data) {
    return { success: true, data: mapServer(response.data) };
  }

  return { success: true };
}

/**
 * Delete a server via DELETE /servers/:id.
 */
export async function deleteServer(serverId: string): Promise<ApiResponse<void>> {
  return adminProxy<void>({
    method: 'DELETE',
    path: `/servers/${serverId}`,
  });
}

// ============================================
// Attach/Detach with Fallback Patterns
// ============================================

/**
 * Attach a runner to a server/infrastructure.
 * Tries multiple endpoint patterns for compatibility:
 * 1. PATCH /runners/:id (update infrastructureId)
 * 2. POST /servers/:serverId/attach-runner
 * 3. POST /runners/:runnerId/attach
 * 4. POST /servers/:serverId/runner
 */
export async function attachRunnerToServer(
  serverId: string,
  runnerId: string
): Promise<AttachResult> {
  console.log(`[ordersAdminProxy] Attaching runner ${runnerId} to server ${serverId}`);

  // Pattern 1: PATCH /runners/:id (primary - aligned with current API)
  const patchResult = await adminProxy({
    method: 'PATCH',
    path: `/runners/${runnerId}`,
    body: { infrastructureId: serverId },
  });

  if (patchResult.success) {
    console.log('[ordersAdminProxy] Attach via PATCH /runners/:id succeeded');
    return { success: true, method: 'patch', message: 'Runner associé via PATCH' };
  }

  // Pattern 2: POST /servers/:serverId/attach-runner
  const serverAttach = await adminProxy({
    method: 'POST',
    path: `/servers/${serverId}/attach-runner`,
    body: { runnerId },
  });

  if (serverAttach.success) {
    console.log('[ordersAdminProxy] Attach via /servers/:id/attach-runner succeeded');
    return { success: true, method: 'server-attach', message: 'Runner associé via server attach' };
  }

  // Pattern 3: POST /runners/:runnerId/attach
  const runnerAttach = await adminProxy({
    method: 'POST',
    path: `/runners/${runnerId}/attach`,
    body: { serverId },
  });

  if (runnerAttach.success) {
    console.log('[ordersAdminProxy] Attach via /runners/:id/attach succeeded');
    return { success: true, method: 'runner-attach', message: 'Runner associé via runner attach' };
  }

  // Pattern 4: POST /servers/:serverId/runner
  const directAttach = await adminProxy({
    method: 'POST',
    path: `/servers/${serverId}/runner`,
    body: { runnerId },
  });

  if (directAttach.success) {
    console.log('[ordersAdminProxy] Attach via /servers/:id/runner succeeded');
    return { success: true, method: 'direct', message: 'Runner associé via endpoint direct' };
  }

  // All patterns failed
  const error = patchResult.error || serverAttach.error || runnerAttach.error || directAttach.error || 'All attach methods failed';
  console.error('[ordersAdminProxy] All attach patterns failed:', error);
  
  return {
    success: false,
    method: 'patch',
    message: `Échec de l'association: ${error}`,
  };
}

/**
 * Detach a runner from its server/infrastructure.
 * Tries multiple patterns for compatibility.
 */
export async function detachRunnerFromServer(
  runnerId: string,
  serverId?: string
): Promise<AttachResult> {
  console.log(`[ordersAdminProxy] Detaching runner ${runnerId} from server ${serverId || '(any)'}`);

  // Pattern 1: PATCH /runners/:id with null infrastructureId (primary)
  const patchResult = await adminProxy({
    method: 'PATCH',
    path: `/runners/${runnerId}`,
    body: { infrastructureId: null },
  });

  if (patchResult.success) {
    console.log('[ordersAdminProxy] Detach via PATCH /runners/:id succeeded');
    return { success: true, method: 'patch', message: 'Runner dissocié via PATCH' };
  }

  // Pattern 2: POST /runners/:runnerId/detach
  const runnerDetach = await adminProxy({
    method: 'POST',
    path: `/runners/${runnerId}/detach`,
    body: {},
  });

  if (runnerDetach.success) {
    console.log('[ordersAdminProxy] Detach via /runners/:id/detach succeeded');
    return { success: true, method: 'runner-attach', message: 'Runner dissocié via runner detach' };
  }

  // Pattern 3: POST /servers/:serverId/detach-runner (if serverId provided)
  if (serverId) {
    const serverDetach = await adminProxy({
      method: 'POST',
      path: `/servers/${serverId}/detach-runner`,
      body: { runnerId },
    });

    if (serverDetach.success) {
      console.log('[ordersAdminProxy] Detach via /servers/:id/detach-runner succeeded');
      return { success: true, method: 'server-attach', message: 'Runner dissocié via server detach' };
    }
  }

  // All patterns failed
  const error = patchResult.error || runnerDetach.error || 'All detach methods failed';
  console.error('[ordersAdminProxy] All detach patterns failed:', error);

  return {
    success: false,
    method: 'patch',
    message: `Échec de la dissociation: ${error}`,
  };
}

// ============================================
// Utility: Check if runner is attached to infrastructure
// ============================================

export function isRunnerAttached(runner: ProxyRunner, infrastructureId: string): boolean {
  return runner.infrastructureId === infrastructureId || runner.serverId === infrastructureId;
}

export function getAttachedInfrastructureId(runner: ProxyRunner): string | null {
  return runner.infrastructureId || runner.serverId || null;
}
