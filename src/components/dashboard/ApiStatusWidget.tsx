import { useState, useEffect, useCallback } from 'react';
import { Link2, CheckCircle, XCircle, Loader2, RefreshCw, Settings, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { 
  checkApiHealth, 
  ORDERS_API_BASE_URL, 
  ORDERS_API_FULL_URL 
} from '@/lib/api-client';

type HealthStatus = 'checking' | 'online' | 'offline' | 'error';

interface HealthResult {
  status: HealthStatus;
  message: string;
  latency?: number;
  version?: string;
}

export function ApiStatusWidget() {
  const [health, setHealth] = useState<HealthResult>({ 
    status: 'checking', 
    message: 'Vérification...' 
  });
  const [isEditing, setIsEditing] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const performHealthCheck = useCallback(async () => {
    setHealth({ status: 'checking', message: 'Vérification...' });
    
    const result = await checkApiHealth();
    setLastCheck(new Date());
    
    if (result.status === 'online') {
      setHealth({ 
        status: 'online', 
        message: 'Connecté',
        latency: result.latency,
        version: result.version
      });
    } else if (result.status === 'offline') {
      setHealth({ 
        status: 'offline', 
        message: 'Hors ligne',
        latency: result.latency
      });
    } else {
      setHealth({ 
        status: 'error', 
        message: 'Erreur',
        latency: result.latency
      });
    }
  }, []);

  useEffect(() => {
    performHealthCheck();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(performHealthCheck, 30000);
    return () => clearInterval(interval);
  }, [performHealthCheck]);

  const statusConfig = {
    checking: { 
      color: 'text-muted-foreground', 
      bg: 'bg-muted/30',
      border: 'border-border/50',
      dot: 'bg-muted-foreground'
    },
    online: { 
      color: 'text-green-500', 
      bg: 'bg-green-500/10',
      border: 'border-green-500/30',
      dot: 'bg-green-500'
    },
    offline: { 
      color: 'text-red-500', 
      bg: 'bg-red-500/10',
      border: 'border-red-500/30',
      dot: 'bg-red-500'
    },
    error: { 
      color: 'text-orange-500', 
      bg: 'bg-orange-500/10',
      border: 'border-orange-500/30',
      dot: 'bg-orange-500'
    }
  };

  const config = statusConfig[health.status];

  const StatusIcon = {
    checking: Loader2,
    online: CheckCircle,
    offline: XCircle,
    error: XCircle
  }[health.status];

  return (
    <div className={cn(
      "glass-panel rounded-xl p-4 transition-all",
      config.border,
      "border"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Link2 className={cn("w-4 h-4", config.color)} />
          <span className="text-sm font-medium">API Orders</span>
        </div>
        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7"
            onClick={performHealthCheck}
            disabled={health.status === 'checking'}
          >
            <RefreshCw className={cn(
              "w-3.5 h-3.5",
              health.status === 'checking' && 'animate-spin'
            )} />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7"
            onClick={() => setIsEditing(!isEditing)}
          >
            {isEditing ? (
              <X className="w-3.5 h-3.5" />
            ) : (
              <Settings className="w-3.5 h-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* Status Display */}
      <div className={cn(
        "flex items-center gap-3 p-3 rounded-lg",
        config.bg
      )}>
        <div className="relative">
          <StatusIcon 
            className={cn(
              "w-8 h-8",
              config.color,
              health.status === 'checking' && 'animate-spin'
            )} 
          />
          {health.status !== 'checking' && (
            <span className={cn(
              "absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full",
              config.dot,
              health.status === 'online' && 'animate-pulse'
            )} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn("font-semibold", config.color)}>
            {health.message}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {ORDERS_API_BASE_URL}
          </p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          {health.latency !== undefined && health.status !== 'checking' && (
            <span>
              <span className="font-medium text-foreground">{health.latency}</span>ms
            </span>
          )}
          {health.version && (
            <span>
              v<span className="font-medium text-foreground">{health.version}</span>
            </span>
          )}
        </div>
        {lastCheck && (
          <span>
            {lastCheck.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {/* Edit Mode */}
      {isEditing && (
        <div className="mt-4 pt-4 border-t border-border/50 space-y-3">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              URL de l'API (lecture seule)
            </label>
            <Input
              value={ORDERS_API_FULL_URL}
              readOnly
              className="font-mono text-xs bg-muted/30"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            L'URL de l'API est configurée de manière centralisée. 
            Pour modifier, contactez l'administrateur système.
          </p>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1"
              onClick={() => {
                navigator.clipboard.writeText(ORDERS_API_FULL_URL);
              }}
            >
              Copier l'URL
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1"
              asChild
            >
              <a href="/settings">
                <Settings className="w-3.5 h-3.5 mr-1" />
                Paramètres
              </a>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}