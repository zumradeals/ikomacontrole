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

    if (!response.ok) {
      const errorMsg = data?.error || data?.message || `HTTP ${response.status}`;
      addLog({
        action: `${request.method} ${request.path}`,
        endpoint: request.path,
        method: request.method,
        statusCode: response.status,
        success: false,
        error: errorMsg,
        duration,
      });
      return { 
        success: false, 
        error: errorMsg, 
        statusCode: response.status 
      };
    }

    addLog({
      action: `${request.method} ${request.path}`,
      endpoint: request.path,
      method: request.method,
      statusCode: 200,
      success: true,
      duration,
    });

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
    runnerName: raw.runner?.name ?? null,
    runnerStatus: raw.runner?.status ?? null,
    status: raw.status,
    createdAt: raw.created_at || raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updated_at || raw.updatedAt,
  };
}

// ============================================
// Operations
// ============================================

export async function listRunners(): Promise<ApiResponse<ProxyRunner[]>> {
  const response = await bffRequest<any[]>({
    method: 'GET',
    path: '/runners',
  });

  if (!response.success || !response.data) {
    return { success: false, error: response.error };
  }

  const rawRunners = Array.isArray(response.data) ? response.data : [];
  
  return {
    success: true,
    data: rawRunners.map(mapRunner),
  };
}

export async function listServers(): Promise<ApiResponse<ProxyServer[]>> {
  const response = await bffRequest<any[]>({
    method: 'GET',
    path: '/servers',
  });

  if (!response.success || !response.data) {
    return { success: false, error: response.error };
  }

  const rawServers = Array.isArray(response.data) ? response.data : [];

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

export async function detachRunnerFromServer(runnerId: string, serverId?: string): Promise<ApiResponse<{ success: boolean; message?: string }>> {
  if (serverId) {
    return bffRequest<any>({
      method: 'PATCH',
      path: `/servers/${serverId}`,
      body: { runnerId: null },
    });
  }
  return { success: false, error: 'Server ID required for detachment' };
}
