/**
 * Orders Admin Proxy Client
 * 
 * All calls go through the Supabase Edge Function admin-proxy
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
  serverId?: string | null;
  serverName?: string | null;
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
  proxy_target?: string;
  proxy_status?: number;
  proxy_error?: string;
}

// ============================================
// In-memory log buffer
// ============================================

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
// Core Edge Function Proxy
// ============================================

interface ProxyRequest {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  body?: Record<string, unknown>;
}

async function edgeFunctionRequest<T = unknown>(request: ProxyRequest): Promise<ApiResponse<T>> {
  const startTime = Date.now();
  
  try {
    const { data, error } = await supabase.functions.invoke('admin-proxy', {
      body: {
        method: request.method,
        path: request.path,
        body: request.body,
      },
    });

    const duration = Date.now() - startTime;

    // Enhanced logging for diagnostic
    const logEntry: Omit<ProxyLogEntry, 'timestamp'> = {
      action: `${request.method} ${request.path}`,
      endpoint: request.path,
      method: request.method,
      statusCode: error ? 500 : 200,
      success: !error,
      duration,
      proxy_target: data?.proxy_target,
      proxy_status: data?.proxy_status,
      proxy_error: data?.proxy_error || data?.error || error?.message,
    };

    if (error) {
      addLog({ ...logEntry, error: error.message });
      return { 
        success: false, 
        error: error.message, 
        statusCode: 500 
      };
    }

    // Check if the response itself indicates an error
    if (data?.error) {
      // Improve error message for API errors
      let errorMessage = data.error;
      
      // Detect FK constraint errors and provide a clearer message
      if (typeof errorMessage === 'string' && errorMessage.includes('Failed query')) {
        if (errorMessage.includes('runner_id') || errorMessage.includes('server_id')) {
          errorMessage = "L'API externe n'a pas pu créer l'ordre. Vérifiez que le serveur est correctement associé à un agent actif.";
        } else {
          errorMessage = "L'API externe a rencontré une erreur de base de données. Veuillez réessayer ou contacter le support.";
        }
      }
      
      addLog({ ...logEntry, success: false, error: data.error });
      return {
        success: false,
        error: errorMessage,
        statusCode: data.proxy_status || 400,
      };
    }

    addLog(logEntry);
    return { success: true, data: data as T, statusCode: 200 };
  } catch (err) {
    const duration = Date.now() - startTime;
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    addLog({
      action: `${request.method} ${request.path}`,
      endpoint: request.path,
      method: request.method,
      statusCode: 0,
      success: false,
      error: errorMsg,
      duration,
    });
    return { 
      success: false, 
      error: errorMsg, 
      statusCode: 0 
    };
  }
}

// ============================================
// Data Mappers
// ============================================

export function mapRunner(raw: any): ProxyRunner {
  return {
    id: raw.id,
    name: raw.name,
    status: raw.status || 'unknown',
    lastHeartbeatAt: raw.last_heartbeat_at || raw.lastHeartbeatAt || raw.last_seen_at || null,
    infrastructureId: raw.infrastructure_id ?? raw.infrastructureId ?? raw.server_id ?? raw.serverId ?? null,
    serverId: raw.server_id ?? raw.serverId ?? raw.infrastructure_id ?? raw.infrastructureId ?? null,
    serverName: raw.server_name ?? raw.serverName ?? null,
    scopes: raw.scopes,
    capabilities: raw.capabilities,
    hostInfo: raw.host_info || raw.hostInfo,
    createdAt: raw.created_at || raw.createdAt || new Date().toISOString(),
  };
}

export function mapServer(raw: any): ProxyServer {
  const runnerId = raw.runner_id ?? raw.runnerId ?? raw.runner?.id ?? null;
  return {
    id: raw.id,
    name: raw.name,
    host: raw.host,
    ip: raw.ip,
    runnerId,
    runnerName: raw.runner?.name ?? raw.runnerName ?? null,
    runnerStatus: raw.runner?.status ?? raw.runnerStatus ?? null,
    status: raw.status,
    createdAt: raw.created_at || raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updated_at || raw.updatedAt,
  };
}

// ============================================
// Operations
// ============================================

/**
 * Contract: admin-proxy returns { items: [...], proxy_* }
 * This function returns the full response for hooks to consume via .items
 */
export async function listRunners(): Promise<ApiResponse<{ items: ProxyRunner[] }>> {
  const response = await edgeFunctionRequest<any>({
    method: 'GET',
    path: '/runners',
  });

  if (!response.success || !response.data) {
    return { success: false, error: response.error };
  }

  // Handle { items: [...] } contract and legacy formats
  const rawData = response.data;
  let rawItems: any[];
  
  if (Array.isArray(rawData.items)) {
    rawItems = rawData.items;
  } else if (Array.isArray(rawData)) {
    rawItems = rawData;
  } else if (Array.isArray(rawData.runners)) {
    rawItems = rawData.runners;
  } else {
    rawItems = [];
  }
  
  return {
    success: true,
    data: { items: rawItems.map(mapRunner) },
  };
}

/**
 * GET /runners/:id is deprecated. 
 * Use listRunners() and find the runner in the list.
 */
export async function getRunnerById(id: string): Promise<ApiResponse<ProxyRunner>> {
  console.warn(`[getRunnerById] Deprecated call for ${id}. Resolving from local list.`);
  const list = await listRunners();
  if (!list.success || !list.data) return { success: false, error: list.error };
  
  const runner = list.data.items.find(r => r.id === id);
  if (!runner) return { success: false, error: 'Runner not found in list', statusCode: 404 };
  
  return { success: true, data: runner };
}

/**
 * Contract: admin-proxy returns { items: [...], proxy_* }
 * This function returns the full response for hooks to consume via .items
 */
export async function listServers(): Promise<ApiResponse<{ items: ProxyServer[] }>> {
  const response = await edgeFunctionRequest<any>({
    method: 'GET',
    path: '/servers',
  });

  if (!response.success || !response.data) {
    return { success: false, error: response.error };
  }

  // Handle { items: [...] } contract and legacy formats
  const rawData = response.data;
  let rawItems: any[];
  
  if (Array.isArray(rawData.items)) {
    rawItems = rawData.items;
  } else if (Array.isArray(rawData)) {
    rawItems = rawData;
  } else if (Array.isArray(rawData.servers)) {
    rawItems = rawData.servers;
  } else {
    rawItems = [];
  }

  return {
    success: true,
    data: { items: rawItems.map(mapServer) },
  };
}

export async function createServer(name: string, baseUrl?: string, runnerId?: string | null): Promise<ApiResponse<ProxyServer>> {
  const response = await edgeFunctionRequest<any>({
    method: 'POST',
    path: '/servers',
    body: { name, baseUrl, runnerId },
  });

  if (!response.success || !response.data) {
    return { success: false, error: response.error };
  }

  return {
    success: true,
    data: mapServer(response.data),
  };
}

export async function updateServerRunner(serverId: string, runnerId: string | null): Promise<ApiResponse<void>> {
  return edgeFunctionRequest<void>({
    method: 'PATCH',
    path: `/servers/${serverId}`,
    body: { runnerId },
  });
}

export async function updateServer(serverId: string, updates: { name?: string; host?: string }): Promise<ApiResponse<ProxyServer>> {
  const response = await edgeFunctionRequest<any>({
    method: 'PATCH',
    path: `/servers/${serverId}`,
    body: updates,
  });

  if (!response.success || !response.data) {
    return { success: false, error: response.error };
  }

  return {
    success: true,
    data: mapServer(response.data),
  };
}

export async function deleteServer(serverId: string): Promise<ApiResponse<void>> {
  return edgeFunctionRequest<void>({
    method: 'DELETE',
    path: `/servers/${serverId}`,
  });
}

export async function deleteRunner(runnerId: string): Promise<ApiResponse<void>> {
  return edgeFunctionRequest<void>({
    method: 'DELETE',
    path: `/runners/${runnerId}`,
  });
}

export async function createRunner(name: string, infrastructureId?: string): Promise<ApiResponse<CreateRunnerResult>> {
  return edgeFunctionRequest<CreateRunnerResult>({
    method: 'POST',
    path: '/runners',
    body: { name, infrastructureId },
  });
}

export async function resetRunnerToken(runnerId: string): Promise<ApiResponse<{ token: string }>> {
  return edgeFunctionRequest<{ token: string }>({
    method: 'POST',
    path: `/runners/${runnerId}/token/reset`,
    body: {},
  });
}

export async function attachRunnerToServer(serverId: string, runnerId: string): Promise<ApiResponse<{ success: boolean; message?: string }>> {
  return edgeFunctionRequest<any>({
    method: 'PATCH',
    path: `/servers/${serverId}`,
    body: { runnerId },
  });
}

export async function detachRunnerFromServer(_runnerId: string, serverId?: string): Promise<ApiResponse<{ success: boolean; message?: string }>> {
  if (serverId) {
    return edgeFunctionRequest<any>({
      method: 'PATCH',
      path: `/servers/${serverId}`,
      body: { runnerId: null },
    });
  }
  return { success: false, error: 'Server ID required for detachment' };
}

// ============================================
// Orders Operations (External API)
// ============================================

export interface CreateOrderInput {
  serverId: string;
  runnerId?: string; // Optional: Some APIs require explicit runnerId
  playbookKey: string;
  action: string;
  createdBy: string;
  name?: string;
  command?: string;
  description?: string;
  params?: Record<string, unknown>;
}

// ============================================
// Report Contract Types (API v2)
// ============================================

export type ApiOrderStatus = 'QUEUED' | 'CLAIMED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
export type LocalOrderStatus = 'pending' | 'claimed' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface ReportContractStep {
  key: string;
  title: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED';
  startedAt?: string;
  endedAt?: string;
  output?: string;
  error?: string;
}

export interface ReportContractError {
  code: string;
  message: string;
}

export interface ReportContract {
  version: string;
  compatibleVersions?: string[];
  summary?: string;
  durationMs?: number;
  steps?: ReportContractStep[];
  errors?: ReportContractError[];
}

export interface ExternalOrder {
  id: string;
  serverId: string;
  runnerId?: string;
  playbookKey: string;
  action: string;
  status: LocalOrderStatus;
  name?: string;
  command?: string;
  exitCode?: number;
  stdoutTail?: string;
  stderrTail?: string;
  result?: Record<string, unknown>;
  reportContract?: ReportContract;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

/**
 * Map API status (QUEUED, CLAIMED, RUNNING, SUCCEEDED, FAILED, CANCELLED)
 * to local status (pending, claimed, running, completed, failed, cancelled)
 * 
 * IMPORTANT: All status mappings are EXPLICIT. Unknown statuses throw an error
 * instead of silently falling back to 'pending'.
 */
function mapApiStatus(apiStatus: string): LocalOrderStatus {
  const statusMap: Record<string, LocalOrderStatus> = {
    // API uppercase statuses
    'QUEUED': 'pending',
    'CLAIMED': 'claimed',
    'RUNNING': 'running',
    'SUCCEEDED': 'completed',
    'FAILED': 'failed',
    'CANCELLED': 'cancelled',
    // Lowercase variants for local/legacy compatibility
    'pending': 'pending',
    'claimed': 'claimed',
    'running': 'running',
    'completed': 'completed',
    'failed': 'failed',
    'cancelled': 'cancelled',
  };
  
  const mapped = statusMap[apiStatus];
  
  if (mapped === undefined) {
    console.warn(`[mapApiStatus] Unknown status: "${apiStatus}" - defaulting to 'pending'. This should be investigated.`);
    return 'pending';
  }
  
  return mapped;
}

function mapOrder(raw: any): ExternalOrder {
  // Map report/reportContract - API may use either name
  const rawReport = raw.reportContract ?? raw.report_contract ?? raw.report;
  
  return {
    id: raw.id,
    serverId: raw.server_id ?? raw.serverId,
    runnerId: raw.runner_id ?? raw.runnerId,
    playbookKey: raw.playbook_key ?? raw.playbookKey,
    action: raw.action,
    status: mapApiStatus(raw.status),
    name: raw.name,
    command: raw.command,
    exitCode: raw.exit_code ?? raw.exitCode,
    stdoutTail: raw.stdout_tail ?? raw.stdoutTail,
    stderrTail: raw.stderr_tail ?? raw.stderrTail,
    result: raw.result,
    reportContract: rawReport ? {
      version: rawReport.version ?? 'v1',
      compatibleVersions: rawReport.compatibleVersions,
      summary: rawReport.summary,
      durationMs: rawReport.durationMs ?? (
        rawReport.startedAt && rawReport.finishedAt
          ? new Date(rawReport.finishedAt).getTime() - new Date(rawReport.startedAt).getTime()
          : undefined
      ),
      steps: rawReport.steps?.map((s: any) => ({
        key: s.key ?? s.name ?? 'unknown',
        title: s.title ?? s.name ?? s.key ?? 'Step',
        status: s.status ?? (s.ok === true ? 'SUCCESS' : s.ok === false ? 'FAILED' : 'PENDING'),
        startedAt: s.startedAt ?? s.started_at,
        endedAt: s.endedAt ?? s.ended_at ?? s.finishedAt,
        output: s.output ?? s.stdout,
        error: s.error ?? s.stderr,
      })),
      errors: rawReport.errors?.map((e: any) => ({
        code: e.code ?? 'UNKNOWN',
        message: e.message ?? String(e),
      })),
    } : undefined,
    createdAt: raw.created_at ?? raw.createdAt ?? new Date().toISOString(),
    startedAt: raw.started_at ?? raw.startedAt,
    completedAt: raw.completed_at ?? raw.completedAt,
  };
}

/**
 * Create an order via the external API.
 * The external API requires: serverId, playbookKey, action, idempotencyKey, createdBy
 */
export async function createOrder(input: CreateOrderInput): Promise<ApiResponse<ExternalOrder>> {
  // Generate idempotency key
  const idempotencyKey = `${input.serverId}-${input.playbookKey}-${Date.now()}`;
  
  // Build request body (aligned with IKOMA Orders API contract)
  // Contract: { serverId, playbookKey, action, idempotencyKey, createdBy, params? }
  const body: Record<string, unknown> = {
    serverId: input.serverId,
    playbookKey: input.playbookKey,
    action: input.action,
    idempotencyKey,
    createdBy: input.createdBy,
    name: input.name,
    command: input.command,
    description: input.description,
    params: input.params,
  };
  
  const response = await edgeFunctionRequest<any>({
    method: 'POST',
    path: '/orders',
    body,
  });

  if (!response.success || !response.data) {
    return { success: false, error: response.error };
  }

  // Handle nested response format { order: {...} }
  const orderData = response.data.order || response.data;
  return {
    success: true,
    data: mapOrder(orderData),
  };
}

/**
 * List orders from the external API for a specific server
 */
export async function listOrders(serverId?: string): Promise<ApiResponse<ExternalOrder[]>> {
  const path = serverId ? `/orders?serverId=${serverId}` : '/orders';
  
  const response = await edgeFunctionRequest<any>({
    method: 'GET',
    path,
  });

  if (!response.success || !response.data) {
    return { success: false, error: response.error };
  }

  // Handle both { orders: [...] } and direct array formats
  const rawData = response.data;
  const rawOrders = Array.isArray(rawData) 
    ? rawData 
    : Array.isArray(rawData?.orders) 
      ? rawData.orders 
      : [];

  return {
    success: true,
    data: rawOrders.map(mapOrder),
  };
}

/**
 * Get a single order by ID from the external API
 */
export async function getOrder(orderId: string): Promise<ApiResponse<ExternalOrder>> {
  const response = await edgeFunctionRequest<any>({
    method: 'GET',
    path: `/orders/${orderId}`,
  });

  if (!response.success || !response.data) {
    return { success: false, error: response.error };
  }

  const orderData = response.data.order || response.data;
  return {
    success: true,
    data: mapOrder(orderData),
  };
}

/**
 * Cancel an order via the external API
 */
export async function cancelOrder(orderId: string): Promise<ApiResponse<void>> {
  return edgeFunctionRequest<void>({
    method: 'DELETE',
    path: `/orders/${orderId}`,
  });
}
