import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Play, 
  RefreshCw, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Loader2,
  Clock,
  Settings
} from 'lucide-react';
import { PlatformService, ServiceStatus } from '@/hooks/usePlatformServices';

interface ServiceCardProps {
  service: PlatformService;
  onPrecheck?: () => void;
  onInstall?: () => void;
  onViewLogs?: () => void;
  onRefresh?: () => void;
  disabled?: boolean;
  isLoading?: boolean;
}

const statusConfig: Record<ServiceStatus, { 
  color: string; 
  icon: React.ComponentType<{ className?: string }>; 
  dotColor: string;
}> = {
  not_configured: { 
    color: 'bg-muted text-muted-foreground border-border', 
    icon: Settings,
    dotColor: 'bg-muted-foreground',
  },
  precheck_failed: { 
    color: 'bg-amber-500/10 text-amber-400 border-amber-500/30', 
    icon: AlertTriangle,
    dotColor: 'bg-amber-500',
  },
  ready_to_install: { 
    color: 'bg-blue-500/10 text-blue-400 border-blue-500/30', 
    icon: Play,
    dotColor: 'bg-blue-500',
  },
  installing: { 
    color: 'bg-purple-500/10 text-purple-400 border-purple-500/30', 
    icon: Loader2,
    dotColor: 'bg-purple-500 animate-pulse',
  },
  installed: { 
    color: 'bg-green-500/10 text-green-400 border-green-500/30', 
    icon: CheckCircle2,
    dotColor: 'bg-green-500',
  },
  failed: { 
    color: 'bg-red-500/10 text-red-400 border-red-500/30', 
    icon: XCircle,
    dotColor: 'bg-red-500',
  },
  stopped: { 
    color: 'bg-gray-500/10 text-gray-400 border-gray-500/30', 
    icon: Clock,
    dotColor: 'bg-gray-500',
  },
};

export function ServiceCard({
  service,
  onPrecheck,
  onInstall,
  onViewLogs,
  onRefresh,
  disabled = false,
  isLoading = false,
}: ServiceCardProps) {
  const Icon = service.icon;
  const config = statusConfig[service.status];
  const StatusIcon = config.icon;

  const canInstall = service.status === 'ready_to_install' || service.status === 'failed';
  const canPrecheck = service.status === 'precheck_failed' || service.status === 'not_configured';
  const showInstalling = service.status === 'installing';

  return (
    <div className="glass-panel rounded-xl p-5 hover:border-primary/30 transition-all">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-6 h-6 text-primary" />
        </div>
        <div className={`w-3 h-3 rounded-full ${config.dotColor}`} />
      </div>

      {/* Title & Description */}
      <h3 className="font-semibold text-lg">{service.name}</h3>
      <p className="text-sm text-muted-foreground mt-1 mb-4">{service.description}</p>

      {/* Status Badge */}
      <Badge variant="outline" className={`${config.color} mb-4`}>
        <StatusIcon className={`w-3 h-3 mr-1.5 ${showInstalling ? 'animate-spin' : ''}`} />
        {service.statusLabel}
      </Badge>

      {/* Prerequisites warning */}
      {service.status === 'precheck_failed' && service.prerequisites.length > 0 && (
        <div className="text-xs text-amber-400 mb-4 flex items-start gap-1.5">
          <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
          <span>Prérequis: {service.prerequisites.join(', ')}</span>
        </div>
      )}

      {/* Last order info */}
      {service.lastOrder && (service.status === 'failed' || service.status === 'installing') && (
        <div className="text-xs text-muted-foreground mb-4 truncate">
          Ordre: {service.lastOrder.name}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {canPrecheck && service.playbooks.precheck && (
          <Button
            size="sm"
            variant="outline"
            onClick={onPrecheck}
            disabled={disabled || isLoading}
          >
            <RefreshCw className={`w-3 h-3 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Precheck
          </Button>
        )}
        
        {canInstall && (
          <Button
            size="sm"
            onClick={onInstall}
            disabled={disabled || isLoading}
          >
            <Play className={`w-3 h-3 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Installer
          </Button>
        )}

        {showInstalling && (
          <Button size="sm" variant="secondary" disabled>
            <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
            En cours...
          </Button>
        )}

        {service.status === 'installed' && (
          <>
            <Button size="sm" variant="outline" onClick={onRefresh} disabled={disabled}>
              <RefreshCw className="w-3 h-3 mr-1.5" />
              Status
            </Button>
            {onViewLogs && (
              <Button size="sm" variant="ghost" onClick={onViewLogs} disabled={disabled}>
                <FileText className="w-3 h-3 mr-1.5" />
                Logs
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
