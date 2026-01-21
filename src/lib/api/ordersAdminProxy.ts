/**
 * Orders Admin Proxy Client (BFF Version)
 * 
 * All calls now go through the local BFF at /api/*
 */

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
// Core BFF Function
// ============================================

interface ProxyRequest {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  body?: Record<string, unknown>;
}

async function bffRequest<T = unknown>(request: ProxyRequest): Promise<ApiResponse<T>> {
  const startTime = Date.now();
  const url = `/api${request.path}`;
  
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    // Find the supabase auth token in localStorage
    const authKey = Object.keys(localStorage).find(key => key.endsWith('-auth-token'));
    if (authKey) {
      const authDataStr = localStorage.getItem(authKey);
      if (authDataStr) {
        try {
          const authData = JSON.parse(authDataStr);
          if (authData.access_token) {
            headers['Authorization'] = `Bearer ${authData.access_token}`;
          }
        } catch (e) {
          console.error('Error parsing auth token', e);
        }
      }
    }

    const response = await fetch(url, {
      method: request.method,
      headers,
      body: request.body ? JSON.stringify(request.body) : undefined,
    });

    const duration = Date.now() - startTime;
    const data = await response.json().catch(() => null);

    // Enhanced logging for BFF diagnostic
    const logEntry: Omit<ProxyLogEntry, 'timestamp'> = {
      action: `${request.method} ${request.path}`,
      endpoint: request.path,
      method: request.method,
      statusCode: response.status,
      success: response.ok,
      duration,
      proxy_target: data?.proxy_target,
      proxy_status: data?.proxy_status,
      proxy_error: data?.proxy_error || data?.error || data?.message,
    };

    if (!response.ok) {
      const errorMsg = data?.error || data?.message || `HTTP ${response.status}`;
      addLog({ ...logEntry, error: errorMsg });
      return { 
        success: false, 
        error: errorMsg, 
        statusCode: response.status 
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

export async function listRunners(): Promise<ApiResponse<ProxyRunner[]>> {
  const response = await bffRequest<any>({
    method: 'GET',
    path: '/runners',
  });

  if (!response.success || !response.data) {
    return { success: false, error: response.error };
  }

  // Handle both { runners: [...] } and direct array formats
  const rawData = response.data;
  const rawRunners = Array.isArray(rawData) 
    ? rawData 
    : Array.isArray(rawData?.runners) 
      ? rawData.runners 
      : [];
  
  return {
    success: true,
    data: rawRunners.map(mapRunner),
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
  
  const runner = list.data.find(r => r.id === id);
  if (!runner) return { success: false, error: 'Runner not found in list', statusCode: 404 };
  
  return { success: true, data: runner };
}

export async function listServers(): Promise<ApiResponse<ProxyServer[]>> {
  const response = await bffRequest<any>({
    method: 'GET',
    path: '/servers',
  });

  if (!response.success || !response.data) {
    return { success: false, error: response.error };
  }

  // Handle both { servers: [...] } and direct array formats
  const rawData = response.data;
  const rawServers = Array.isArray(rawData) 
    ? rawData 
    : Array.isArray(rawData?.servers) 
      ? rawData.servers 
      : [];

  return {
    success: true,
    data: rawServers.map(mapServer),
  };
}

export async function createServer(name: string, baseUrl?: string, runnerId?: string | null): Promise<ApiResponse<ProxyServer>> {
  const response = await bffRequest<any>({
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
  return bffRequest<void>({
    method: 'PATCH',
    path: `/servers/${serverId}`,
    body: { runnerId },
  });
}

export async function updateServer(serverId: string, updates: { name?: string; host?: string }): Promise<ApiResponse<ProxyServer>> {
  const response = await bffRequest<any>({
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
  return bffRequest<void>({
    method: 'DELETE',
    path: `/servers/${serverId}`,
  });
}

export async function deleteRunner(runnerId: string): Promise<ApiResponse<void>> {
  return bffRequest<void>({
    method: 'DELETE',
    path: `/runners/${runnerId}`,
  });
}

export async function createRunner(name: string, infrastructureId?: string): Promise<ApiResponse<CreateRunnerResult>> {
  return bffRequest<CreateRunnerResult>({
    method: 'POST',
    path: '/runners',
    body: { name, infrastructureId },
  });
}

export async function resetRunnerToken(runnerId: string): Promise<ApiResponse<{ token: string }>> {
  return bffRequest<{ token: string }>({
    method: 'POST',
    path: `/runners/${runnerId}/token/reset`,
    body: {},
  });
}

export async function attachRunnerToServer(serverId: string, runnerId: string): Promise<ApiResponse<{ success: boolean; message?: string }>> {
  return bffRequest<any>({
    method: 'PATCH',
    path: `/servers/${serverId}`,
    body: { runnerId },
  });
}

export async function detachRunnerFromServer(_runnerId: string, serverId?: string): Promise<ApiResponse<{ success: boolean; message?: string }>> {
  if (serverId) {
    return bffRequest<any>({
      method: 'PATCH',
      path: `/servers/${serverId}`,
      body: { runnerId: null },
    });
  }
  return { success: false, error: 'Server ID required for detachment' };
}
