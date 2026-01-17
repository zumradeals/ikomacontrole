import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useApiUrls } from '@/hooks/useApiUrls';

type HealthStatus = 'checking' | 'online' | 'offline' | 'error';

interface HealthResult {
  status: HealthStatus;
  message: string;
  latency?: number;
  version?: string;
}

export function ApiHealthCheck() {
  const { baseUrl } = useApiUrls();
  const [health, setHealth] = useState<HealthResult>({
    status: 'checking',
    message: 'Vérification en cours...',
  });

  const performHealthCheck = async () => {
    setHealth({ status: 'checking', message: 'Vérification en cours...' });

    const startTime = Date.now();

    try {
      // Direct call to public /health endpoint (no auth required, no proxy needed)
      // Note: This may fail with CORS in browser if the API doesn't allow it
      // In that case, we'll use the baseUrl from settings which should be accessible
      const response = await fetch(`${baseUrl}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      const latency = Date.now() - startTime;

      if (!response.ok) {
        setHealth({
          status: 'offline',
          message: `API erreur (HTTP ${response.status})`,
          latency,
        });
        return;
      }

      const data = await response.json().catch(() => ({}));

      setHealth({
        status: 'online',
        message: 'API joignable',
        latency,
        version: data?.version,
      });
    } catch (e) {
      const latency = Date.now() - startTime;
      // CORS errors or network failures
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
