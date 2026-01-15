/**
 * API Client for IKOMA Orders API
 * Uses edge function proxy to avoid CORS issues
 * Target: https://automate.ikomadigit.com/v1
 */

import { supabase } from '@/integrations/supabase/client';

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
 * Get the edge function URL for the proxy
 */
function getProxyUrl(path: string): string {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'lqocccsxzqnbcwshseom';
  return `https://${projectId}.supabase.co/functions/v1/orders-proxy?path=${encodeURIComponent(path)}`;
}

/**
 * Make an API request to the Orders API via edge function proxy
 */
export async function apiRequest<T = unknown>(
  endpoint: string,
  options: ApiClientOptions = {}
): Promise<ApiResponse<T>> {
  const { method = 'GET', body } = options;
  
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    const response = await fetch(getProxyUrl(endpoint), {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const result = await response.json();

    if (!result.success) {
      return {
        success: false,
        error: result.error || `HTTP ${result.status}`,
        status: result.status || 0,
      };
    }

    return {
      success: true,
      data: result.data as T,
      status: result.status,
      latency: result.latency,
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
  try {
    const result = await apiRequest<{ version?: string; status?: string }>('/health');
    
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
    const result = await apiRequest('/ready');
    return result.success;
  } catch {
    return false;
  }
}

// Export constants for use elsewhere
export const ORDERS_API_BASE_URL = API_BASE_URL;
export const ORDERS_API_PREFIX = API_PREFIX;
export const ORDERS_API_FULL_URL = `${API_BASE_URL}${API_PREFIX}`;
