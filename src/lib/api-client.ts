/**
 * API Client for IKOMA Orders API
 * Direct frontend access - CORS configured on API side
 * Base: https://automate.ikomadigit.com
 * Root endpoints: /health, /ready
 * Business routes: /v1/*
 */

const API_BASE_URL = 'https://automate.ikomadigit.com';
const API_PREFIX = '/v1';

export interface ApiClientOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: unknown;
  headers?: Record<string, string>;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  status: number;
  latency?: number;
}

/**
 * Build the full URL for an API endpoint
 * Root endpoints (/health, /ready) go directly to base
 * Business endpoints go under /v1
 */
function buildUrl(endpoint: string, isRootEndpoint: boolean = false): string {
  if (isRootEndpoint) {
    return `${API_BASE_URL}${endpoint}`;
  }
  return `${API_BASE_URL}${API_PREFIX}${endpoint}`;
}

/**
 * Make an API request to the Orders API (direct call)
 */
export async function apiRequest<T = unknown>(
  endpoint: string,
  options: ApiClientOptions = {},
  isRootEndpoint: boolean = false
): Promise<ApiResponse<T>> {
  const { method = 'GET', body, headers = {} } = options;
  
  const startTime = Date.now();
  
  try {
    const response = await fetch(buildUrl(endpoint, isRootEndpoint), {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const latency = Date.now() - startTime;
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        success: false,
        error: data?.message || data?.error || `HTTP ${response.status}`,
        status: response.status,
        latency,
      };
    }

    return {
      success: true,
      data: data as T,
      status: response.status,
      latency,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
      status: 0,
      latency: Date.now() - startTime,
    };
  }
}

/**
 * Health check endpoint (at root level)
 */
export async function checkApiHealth(): Promise<{
  status: 'online' | 'offline' | 'error';
  latency: number;
  version?: string;
  message?: string;
}> {
  try {
    const result = await apiRequest<{ version?: string; status?: string }>('/health', {}, true);
    
    if (result.success && result.data) {
      return {
        status: 'online',
        latency: result.latency || 0,
        version: result.data.version,
      };
    }
    
    return {
      status: 'error',
      latency: result.latency || 0,
      message: result.error || `HTTP ${result.status}`,
    };
  } catch (error) {
    return {
      status: 'offline',
      latency: 0,
      message: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

/**
 * Ready check endpoint (at root level)
 */
export async function checkApiReady(): Promise<boolean> {
  try {
    const result = await apiRequest('/ready', {}, true);
    return result.success;
  } catch {
    return false;
  }
}

// Export constants for use elsewhere
export const ORDERS_API_BASE_URL = API_BASE_URL;
export const ORDERS_API_PREFIX = API_PREFIX;
export const ORDERS_API_FULL_URL = `${API_BASE_URL}${API_PREFIX}`;
