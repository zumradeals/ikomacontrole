import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ApiHealthCheckProps {
  baseUrl: string;
}

type HealthStatus = 'checking' | 'online' | 'offline' | 'error';

interface HealthResult {
  status: HealthStatus;
  message: string;
  latency?: number;
  version?: string;
}

export function ApiHealthCheck({ baseUrl }: ApiHealthCheckProps) {
  const [health, setHealth] = useState<HealthResult>({ 
    status: 'checking', 
    message: 'Vérification en cours...' 
  });

  const checkHealth = async () => {
    if (!baseUrl) {
      setHealth({ status: 'error', message: 'URL non configurée' });
      return;
    }

    setHealth({ status: 'checking', message: 'Vérification en cours...' });
    
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${baseUrl}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      
      const latency = Date.now() - startTime;
      
      if (response.ok) {
        const data = await response.json();
        setHealth({ 
          status: 'online', 
          message: `API joignable`,
          latency,
          version: data.version
        });
      } else {
        setHealth({ 
          status: 'error', 
          message: `Erreur HTTP ${response.status}`,
          latency 
        });
      }
    } catch (error) {
      const latency = Date.now() - startTime;
      setHealth({ 
        status: 'offline', 
        message: error instanceof Error ? error.message : 'Connexion impossible',
        latency
      });
    }
  };

  useEffect(() => {
    checkHealth();
  }, [baseUrl]);

  const statusColors = {
    checking: 'text-muted-foreground',
    online: 'text-green-500',
    offline: 'text-red-500',
    error: 'text-orange-500'
  };

  const StatusIcon = {
    checking: Loader2,
    online: CheckCircle,
    offline: XCircle,
    error: XCircle
  }[health.status];

  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
      <div className="flex items-center gap-3">
        <StatusIcon 
          className={`w-5 h-5 ${statusColors[health.status]} ${health.status === 'checking' ? 'animate-spin' : ''}`} 
        />
        <div>
          <p className={`text-sm font-medium ${statusColors[health.status]}`}>
            {health.message}
          </p>
          {health.latency !== undefined && health.status !== 'checking' && (
            <p className="text-xs text-muted-foreground">
              Latence: {health.latency}ms
              {health.version && ` • Version: ${health.version}`}
            </p>
          )}
        </div>
      </div>
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={checkHealth}
        disabled={health.status === 'checking'}
      >
        <RefreshCw className={`w-4 h-4 ${health.status === 'checking' ? 'animate-spin' : ''}`} />
      </Button>
    </div>
  );
}
