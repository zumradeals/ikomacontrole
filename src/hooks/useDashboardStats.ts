import { useQuery } from '@tanstack/react-query';
import { useSettings } from './useSettings';

// Hook to get a single setting value
function useSetting(key: string) {
  const { getSetting, isLoading } = useSettings();
  return {
    data: isLoading ? undefined : getSetting(key) || undefined,
    isLoading,
  };
}

interface DashboardStats {
  runners: {
    online: number;
    total: number;
    offline: number;
  };
  orders: {
    pending: number;
    running: number;
    queue: number;
    completed_24h: number;
    failed_24h: number;
  };
  timestamp: string;
}

export function useDashboardStats() {
  const { data: runnerBaseUrl } = useSetting('runner_base_url');

  return useQuery({
    queryKey: ['dashboard-stats', runnerBaseUrl],
    queryFn: async (): Promise<DashboardStats> => {
      if (!runnerBaseUrl) {
        throw new Error('Runner API URL not configured');
      }
      
      const response = await fetch(`${runnerBaseUrl}/stats`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch stats: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Unknown error');
      }
      
      return data.stats;
    },
    enabled: !!runnerBaseUrl,
    refetchInterval: 10000, // Refetch every 10 seconds
    staleTime: 5000,
  });
}

export function useApiHealthCheck(baseUrl: string | undefined) {
  return useQuery({
    queryKey: ['api-health', baseUrl],
    queryFn: async () => {
      if (!baseUrl) throw new Error('No URL');
      
      const startTime = Date.now();
      const response = await fetch(`${baseUrl}/health`);
      const latency = Date.now() - startTime;
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      return {
        status: 'online' as const,
        latency,
        version: data.version,
        heartbeatInterval: data.heartbeat_interval,
        pollInterval: data.poll_interval,
        offlineThreshold: data.offline_threshold,
      };
    },
    enabled: !!baseUrl,
    refetchInterval: 30000,
    retry: 1,
  });
}

export function useTestOrder(runnerId: string) {
  const { data: runnerBaseUrl } = useSetting('runner_base_url');
  
  return {
    baseUrl: runnerBaseUrl,
    canTest: !!runnerBaseUrl && !!runnerId,
  };
}
