import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

type HealthStatus = 'checking' | 'online' | 'offline' | 'error';

interface HealthResult {
  status: HealthStatus;
  message: string;
  latency?: number;
  version?: string;
}

export function ApiHealthCheck() {
  const [health, setHealth] = useState<HealthResult>({
    status: 'checking',
    message: 'Vérification en cours...',
  });

  const performHealthCheck = async () => {
    setHealth({ status: 'checking', message: 'Vérification en cours...' });

    const startTime = Date.now();

    try {
      // Use runner-proxy Edge Function instead of direct call to avoid CORS/Fetch issues
      // We use a dummy runnerId/token for health check as it's usually public or doesn't require specific runner auth
      const { data, error } = await supabase.functions.invoke('runner-proxy', {
        body: {
          method: 'GET',
          path: '/health',
          runnerId: 'health-check',
          runnerToken: 'health-check',
        },
      });

      const latency = Date.now() - startTime;

      if (error) {
        setHealth({
          status: 'offline',
          message: error.message || 'Proxy unreachable',
          latency,
        });
        return;
      }

      // If we got data, the API is reachable through the proxy
      setHealth({
        status: 'online',
        message: 'API joignable (via proxy)',
        latency,
        version: data?.version,
      });
    } catch (e) {
      const latency = Date.now() - startTime;
      setHealth({
        status: 'offline',
        message: e instanceof Error ? e.message : 'Connexion impossible',
        latency,
      });
    }
  };

  useEffect(() => {
    performHealthCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusColors = {
    checking: 'text-muted-foreground',
    online: 'text-green-500',
    offline: 'text-red-500',
    error: 'text-orange-500',
  };

  const StatusIcon = {
    checking: Loader2,
    online: CheckCircle,
    offline: XCircle,
    error: XCircle,
  }[health.status];

  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
      <div className="flex items-center gap-3">
        <StatusIcon
          className={`w-5 h-5 ${statusColors[health.status]} ${health.status === 'checking' ? 'animate-spin' : ''}`}
        />
        <div>
          <p className={`text-sm font-medium ${statusColors[health.status]}`}>{health.message}</p>
          <p className="text-xs text-muted-foreground">
            IKOMA API Proxy
            {health.latency !== undefined && health.status !== 'checking' && <> • Latence: {health.latency}ms</>}
            {health.version && ` • v${health.version}`}
          </p>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={performHealthCheck}
        disabled={health.status === 'checking'}
      >
        <RefreshCw className={`w-4 h-4 ${health.status === 'checking' ? 'animate-spin' : ''}`} />
      </Button>
    </div>
  );
}
