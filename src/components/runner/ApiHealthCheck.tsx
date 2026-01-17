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
  const { baseUrl, isLoading: urlsLoading } = useApiUrls();

  const [health, setHealth] = useState<HealthResult>({
    status: 'checking',
    message: 'Vérification en cours...',
  });

  const performHealthCheck = async () => {
    if (!baseUrl) {
      setHealth({ status: 'error', message: "URL API non configurée" });
      return;
    }

    setHealth({ status: 'checking', message: 'Vérification en cours...' });

    const startTime = Date.now();

    try {
      const response = await fetch(`${baseUrl}/health`, { method: 'GET' });
      const latency = Date.now() - startTime;
      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        setHealth({
          status: 'online',
          message: 'API joignable',
          latency,
          version: data.version,
        });
        return;
      }

      setHealth({
        status: 'error',
        message: data.message || data.error || `HTTP ${response.status}`,
        latency,
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
  }, [baseUrl]);

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
            {baseUrl || '—'}
            {health.latency !== undefined && health.status !== 'checking' && <> • Latence: {health.latency}ms</>}
            {health.version && ` • v${health.version}`}
          </p>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={performHealthCheck}
        disabled={urlsLoading || health.status === 'checking'}
      >
        <RefreshCw className={`w-4 h-4 ${health.status === 'checking' ? 'animate-spin' : ''}`} />
      </Button>
    </div>
  );
}
