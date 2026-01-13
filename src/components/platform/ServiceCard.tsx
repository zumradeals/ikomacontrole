import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Play, 
  RefreshCw, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Loader2,
  Clock,
  Settings,
  Route,
  ExternalLink,
  HelpCircle,
  Search,
  ShieldCheck
} from 'lucide-react';
import { PlatformService, ServiceStatus } from '@/hooks/usePlatformServices';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ServiceCardProps {
  service: PlatformService;
  onPrecheck?: () => void;
  onInstall?: () => void;
  onViewLogs?: () => void;
  onRefresh?: () => void;
  onConfigure?: () => void;
  onSetup?: () => void;
  onVerify?: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  /** For Supabase: disable install if Caddy not verified */
  caddyNotReady?: boolean;
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
  unknown: { 
    color: 'bg-muted text-muted-foreground border-border', 
    icon: HelpCircle,
    dotColor: 'bg-muted-foreground',
  },
  stale: { 
    color: 'bg-amber-500/10 text-amber-400 border-amber-500/30', 
    icon: AlertTriangle,
    dotColor: 'bg-amber-500',
  },
  checking: { 
    color: 'bg-purple-500/10 text-purple-400 border-purple-500/30', 
    icon: Search,
    dotColor: 'bg-purple-500 animate-pulse',
  },
};

export function ServiceCard({
  service,
  onPrecheck,
  onInstall,
  onViewLogs,
  onRefresh,
  onConfigure,
  onSetup,
  onVerify,
  disabled = false,
  isLoading = false,
  caddyNotReady = false,
}: ServiceCardProps) {
  const Icon = service.icon;
  const config = statusConfig[service.status];
  const StatusIcon = config.icon;

  const canInstall = service.status === 'ready_to_install' || service.status === 'failed';
  const canPrecheck = service.status === 'precheck_failed' || service.status === 'not_configured';
  const showInstalling = service.status === 'installing';
  const showChecking = service.status === 'checking';
  const needsVerification = service.status === 'unknown' || service.status === 'stale';
  const isCaddyService = service.id === 'caddy';
  const isSupabaseService = service.id === 'supabase';
  
  // Format last verification time for Caddy
  const lastVerifiedLabel = service.lastVerifiedAt 
    ? formatDistanceToNow(service.lastVerifiedAt, { addSuffix: true, locale: fr })
    : null;

  return (
    <TooltipProvider>
      <div className="glass-panel rounded-xl p-5 hover:border-primary/30 transition-all">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="w-6 h-6 text-primary" />
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={`w-3 h-3 rounded-full ${config.dotColor} cursor-help`} />
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-xs">
              <p className="font-medium">{service.statusLabel}</p>
              {isCaddyService && lastVerifiedLabel && (
                <p className="text-xs text-muted-foreground mt-1">
                  Dernière vérification: {lastVerifiedLabel}
                </p>
              )}
              {isCaddyService && service.staleReason && (
                <p className="text-xs text-amber-400 mt-1">{service.staleReason}</p>
              )}
              {isCaddyService && service.runtimeVerification && (
                <div className="text-xs mt-2 space-y-0.5">
                  <p>Version: {service.runtimeVerification.version}</p>
                  <p>HTTPS: {service.runtimeVerification.https_ready ? '✓ Prêt' : '✗ Non prêt'}</p>
                </div>
              )}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Title & Description */}
        <h3 className="font-semibold text-lg">{service.name}</h3>
        <p className="text-sm text-muted-foreground mt-1 mb-4">{service.description}</p>

        {/* Status Badge with tooltip for Caddy */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className={`${config.color} mb-4 cursor-help`}>
              <StatusIcon className={`w-3 h-3 mr-1.5 ${showInstalling || showChecking ? 'animate-spin' : ''}`} />
              {service.statusLabel}
            </Badge>
          </TooltipTrigger>
          {isCaddyService && (needsVerification || service.staleReason) && (
            <TooltipContent>
              <p className="text-xs">
                {service.staleReason || 'Aucune vérification runtime récente'}
              </p>
            </TooltipContent>
          )}
        </Tooltip>

        {/* Prerequisites warning */}
        {service.status === 'precheck_failed' && service.prerequisites.length > 0 && (
          <div className="text-xs text-amber-400 mb-4 flex items-start gap-1.5">
            <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
            <span>Prérequis: {service.prerequisites.join(', ')}</span>
          </div>
        )}

        {/* Stale reason for Caddy */}
        {isCaddyService && service.staleReason && service.status !== 'checking' && (
          <div className="text-xs text-amber-400 mb-4 flex items-start gap-1.5">
            <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
            <span>{service.staleReason}</span>
          </div>
        )}

        {/* Caddy not ready warning for Supabase */}
        {isSupabaseService && caddyNotReady && (
          <div className="text-xs text-amber-400 mb-4 flex items-start gap-1.5">
            <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
            <span>Caddy doit être vérifié et HTTPS prêt</span>
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
          {/* Verify button for Caddy when status is unknown or stale */}
          {isCaddyService && needsVerification && onVerify && (
            <Button
              size="sm"
              variant="default"
              onClick={onVerify}
              disabled={disabled || isLoading}
            >
              <ShieldCheck className={`w-3 h-3 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
              Vérifier l'état
            </Button>
          )}

          {/* Checking in progress */}
          {showChecking && (
            <Button size="sm" variant="secondary" disabled>
              <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
              Vérification...
            </Button>
          )}

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
          
          {/* Supabase install - disabled if Caddy not ready */}
          {canInstall && isSupabaseService && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    size="sm"
                    onClick={onInstall}
                    disabled={disabled || isLoading || caddyNotReady}
                  >
                    <ExternalLink className="w-3 h-3 mr-1.5" />
                    Configuration guidée
                  </Button>
                </span>
              </TooltipTrigger>
              {caddyNotReady && (
                <TooltipContent>
                  <p className="text-xs">Caddy doit être installé et HTTPS prêt</p>
                </TooltipContent>
              )}
            </Tooltip>
          )}
          
          {/* Other services install */}
          {canInstall && !isSupabaseService && (
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
              {/* Verify button for Caddy even when installed */}
              {isCaddyService && onVerify && (
                <Button size="sm" variant="outline" onClick={onVerify} disabled={disabled || isLoading}>
                  <ShieldCheck className="w-3 h-3 mr-1.5" />
                  Vérifier
                </Button>
              )}
              {onConfigure && (
                <Button size="sm" variant="default" onClick={onConfigure} disabled={disabled}>
                  <Route className="w-3 h-3 mr-1.5" />
                  Routes
                </Button>
              )}
              {!isCaddyService && (
                <Button size="sm" variant="outline" onClick={onRefresh} disabled={disabled}>
                  <RefreshCw className="w-3 h-3 mr-1.5" />
                  Status
                </Button>
              )}
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
    </TooltipProvider>
  );
}
