import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { 
  Rocket, 
  GitBranch, 
  Server, 
  Play, 
  Loader2, 
  CheckCircle2, 
  XCircle,
  Clock,
  ExternalLink,
  MoreVertical,
  Trash2,
  RotateCcw,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Deployment, DeploymentStatus } from '@/hooks/useDeployments';

const statusConfig: Record<DeploymentStatus, { 
  icon: React.ReactNode; 
  label: string; 
  className: string 
}> = {
  draft: { 
    icon: <Clock className="w-3 h-3" />, 
    label: 'Brouillon', 
    className: 'bg-muted text-muted-foreground' 
  },
  planning: { 
    icon: <Loader2 className="w-3 h-3 animate-spin" />, 
    label: 'Planification', 
    className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' 
  },
  ready: { 
    icon: <Play className="w-3 h-3" />, 
    label: 'Prêt', 
    className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' 
  },
  running: { 
    icon: <Loader2 className="w-3 h-3 animate-spin" />, 
    label: 'En cours', 
    className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' 
  },
  applied: { 
    icon: <CheckCircle2 className="w-3 h-3" />, 
    label: 'Déployé', 
    className: 'bg-green-500/20 text-green-400 border-green-500/30' 
  },
  failed: { 
    icon: <XCircle className="w-3 h-3" />, 
    label: 'Échec', 
    className: 'bg-red-500/20 text-red-400 border-red-500/30' 
  },
  rolled_back: { 
    icon: <RotateCcw className="w-3 h-3" />, 
    label: 'Rollback', 
    className: 'bg-orange-500/20 text-orange-400 border-orange-500/30' 
  },
};

const deployTypeLabels: Record<string, string> = {
  nodejs: 'Node.js',
  docker_compose: 'Docker Compose',
  static_site: 'Site Statique',
  custom: 'Custom',
};

interface DeploymentCardProps {
  deployment: Deployment;
  onRun?: () => void;
  onView?: () => void;
  onDelete?: () => void;
  onRollback?: () => void;
}

export function DeploymentCard({ 
  deployment, 
  onRun, 
  onView, 
  onDelete,
  onRollback,
}: DeploymentCardProps) {
  const config = statusConfig[deployment.status];
  const canRun = deployment.status === 'ready' || deployment.status === 'failed';
  const canRollback = deployment.status === 'applied';

  return (
    <div className="glass-panel rounded-lg p-4 hover:border-primary/30 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
            <Rocket className="w-5 h-5 text-primary" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium truncate">{deployment.app_name}</h4>
              <Badge className={config.className}>
                {config.icon}
                <span className="ml-1">{config.label}</span>
              </Badge>
            </div>
            
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <GitBranch className="w-3 h-3" />
                <span>{deployment.branch}</span>
              </div>
              <div className="flex items-center gap-1">
                <Server className="w-3 h-3" />
                <span>{deployTypeLabels[deployment.deploy_type]}</span>
              </div>
              {deployment.domain && (
                <div className="flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" />
                  <span>{deployment.domain}</span>
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground mt-2">
              {deployment.completed_at 
                ? `Terminé ${formatDistanceToNow(new Date(deployment.completed_at), { addSuffix: true, locale: fr })}`
                : `Créé ${formatDistanceToNow(new Date(deployment.created_at), { addSuffix: true, locale: fr })}`
              }
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canRun && onRun && (
            <Button size="sm" onClick={onRun}>
              <Play className="w-4 h-4 mr-1" />
              Lancer
            </Button>
          )}
          
          {deployment.status === 'running' && (
            <Button size="sm" variant="outline" onClick={onView}>
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              Voir
            </Button>
          )}

          {(deployment.status === 'applied' || deployment.status === 'failed') && onView && (
            <Button size="sm" variant="outline" onClick={onView}>
              Détails
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-8 w-8">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onView && (
                <DropdownMenuItem onClick={onView}>
                  Voir les détails
                </DropdownMenuItem>
              )}
              {canRollback && onRollback && (
                <DropdownMenuItem onClick={onRollback}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Rollback
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem onClick={onDelete} className="text-destructive">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Supprimer
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {deployment.error_message && (
        <div className="mt-3 p-2 rounded bg-red-500/10 border border-red-500/30">
          <p className="text-xs text-red-400 font-mono">{deployment.error_message}</p>
        </div>
      )}
    </div>
  );
}
