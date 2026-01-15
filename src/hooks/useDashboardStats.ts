import { useQuery } from '@tanstack/react-query';
import { ORDERS_API_FULL_URL, checkApiHealth } from '@/lib/api-client';

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
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async (): Promise<DashboardStats> => {
      const response = await fetch(`${ORDERS_API_FULL_URL}/stats`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch stats: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Unknown error');
      }
      
      return data.stats;
    },
    refetchInterval: 10000, // Refetch every 10 seconds
    staleTime: 5000,
  });
}

export function useApiHealthCheck() {
  return useQuery({
    queryKey: ['api-health'],
    queryFn: async () => {
      return await checkApiHealth();
    },
    refetchInterval: 30000,
    retry: 1,
  });
}

export function useTestOrder(runnerId: string) {
  return {
    baseUrl: ORDERS_API_FULL_URL,
    canTest: !!runnerId,
  };
}
