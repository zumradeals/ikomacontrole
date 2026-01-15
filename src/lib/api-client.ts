/**
 * API Client for IKOMA Orders API
 * Base URL: https://automate.ikomadigit.com
 * Prefix: /v1
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
}

/**
 * Get the admin API key from environment
 */
function getAdminKey(): string {
  // In edge functions, use Deno.env
  // In frontend, we'll need to proxy through edge function
  return '';
}

/**
 * Make an API request to the Orders API
 * Note: /health and /ready are at root level, other routes use /v1 prefix
 */
export async function apiRequest<T = unknown>(
  endpoint: string,
  options: ApiClientOptions = {}
): Promise<ApiResponse<T>> {
  const { method = 'GET', body, headers = {} } = options;
  
  // /health and /ready are at root, others use /v1 prefix
  const isRootEndpoint = endpoint === '/health' || endpoint === '/ready';
  const url = isRootEndpoint 
    ? `${API_BASE_URL}${endpoint}`
    : `${API_BASE_URL}${API_PREFIX}${endpoint}`;

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  try {
    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        success: false,
        error: data?.error || data?.message || `HTTP ${response.status}`,
        status: response.status,
      };
    }

    return {
      success: true,
      data: data as T,
      status: response.status,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
      status: 0,
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
  const startTime = Date.now();
  
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    
    const latency = Date.now() - startTime;
    
    if (response.ok) {
      const data = await response.json();
      return {
        status: 'online',
        latency,
        version: data.version,
      };
    }
    
    return {
      status: 'error',
      latency,
      message: `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      status: 'offline',
      latency: Date.now() - startTime,
      message: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

/**
 * Ready check endpoint (at root level)
 */
export async function checkApiReady(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/ready`);
    return response.ok;
  } catch {
    return false;
  }
}

// Export constants for use elsewhere
export const ORDERS_API_BASE_URL = API_BASE_URL;
export const ORDERS_API_PREFIX = API_PREFIX;
export const ORDERS_API_FULL_URL = `${API_BASE_URL}${API_PREFIX}`;
