/**
 * API Client for IKOMA Runner Platform (via BFF)
 * 
 * All calls now go through the local BFF at /api/*
 */

// In production, the BFF is served on the same domain under /api
const API_BASE_URL = '/api';

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
 * Make an API request to the BFF
 */
export async function apiRequest<T = unknown>(
  endpoint: string,
  options: ApiClientOptions = {}
): Promise<ApiResponse<T>> {
  const { method = 'GET', body, headers = {} } = options;
  
  const startTime = Date.now();
  
  // Ensure endpoint starts with / and doesn't duplicate /api
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_BASE_URL}${cleanEndpoint}`;
  
  try {
    const response = await fetch(url, {
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
 * Health check endpoint
 */
export async function checkApiHealth(): Promise<{
  status: 'online' | 'offline' | 'error';
  latency: number;
  version?: string;
  message?: string;
}> {
  try {
    const result = await apiRequest<{ status?: string }>('/health');
    
    if (result.success && result.data) {
      return {
        status: 'online',
        latency: result.latency || 0,
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
 * Ready check endpoint
 */
export async function checkApiReady(): Promise<boolean> {
  try {
    const result = await apiRequest('/health');
    return result.success;
  } catch {
    return false;
  }
}

// Export constants for compatibility
export const ORDERS_API_BASE_URL = API_BASE_URL;
export const ORDERS_API_V1_URL = API_BASE_URL;
export const ORDERS_API_FULL_URL = API_BASE_URL;
