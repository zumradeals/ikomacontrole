/**
 * API Client for IKOMA Orders API
 * Direct frontend access - CORS configured on API side
 * 
 * Environment variables:
 * - VITE_ORDERS_API_BASE_URL: Base URL for root endpoints (/health, /ready, /install-runner.sh)
 * - VITE_ORDERS_API_V1_URL: V1 URL for business routes (/v1/*)
 */

// Environment-based URLs with fallbacks
const API_BASE_URL = import.meta.env.VITE_ORDERS_API_BASE_URL || 'https://api.ikomadigit.com';
const API_V1_URL = import.meta.env.VITE_ORDERS_API_V1_URL || 'https://api.ikomadigit.com/v1';

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
 * Root endpoints (/health, /ready) go to base URL
 * Business endpoints go to V1 URL
 */
function buildUrl(endpoint: string, isRootEndpoint: boolean = false): string {
  if (isRootEndpoint) {
    return `${API_BASE_URL}${endpoint}`;
  }
  return `${API_V1_URL}${endpoint}`;
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

/**
 * Get the install script URL for runners
 * IMPORTANT: Must use BASE URL, never V1 URL
 * @throws Error if URL contains /v1/
 */
export function getInstallScriptUrl(): string {
  const scriptUrl = `${API_BASE_URL}/install-runner.sh`;
  
  // Safeguard: prevent misconfigured URLs
  if (scriptUrl.includes('/v1/')) {
    throw new Error('Installer URL misconfigured: must not contain /v1/');
  }
  
  return scriptUrl;
}

/**
 * Build the full install command for a runner
 * @param token - The authentication token for the runner
 */
export function buildInstallCommand(token: string): string {
  const scriptUrl = getInstallScriptUrl();
  return `curl -sSL ${scriptUrl} | bash -s -- --token ${token} --api-url ${API_BASE_URL}`;
}

// Export constants for use elsewhere
export const ORDERS_API_BASE_URL = API_BASE_URL;
export const ORDERS_API_V1_URL = API_V1_URL;
// Alias for backward compatibility
export const ORDERS_API_FULL_URL = API_V1_URL;
