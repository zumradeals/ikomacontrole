import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Server, Wifi, WifiOff, Pause, HelpCircle, Cpu, HardDrive, MonitorSmartphone, Trash2, Building2 } from 'lucide-react';
import { TestOrderButton } from './TestOrderButton';
import { RunnerDiagnostics } from './RunnerDiagnostics';
import { useRunners, useDeleteRunner } from '@/hooks/useRunners';
import { useInfrastructures } from '@/hooks/useInfrastructures';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface HostInfo {
  hostname?: string;
  os?: string;
  arch?: string;
  kernel?: string;
  cpus?: number;
  memory_mb?: number;
  ip?: string;
}

const statusConfig = {
  online: { icon: Wifi, label: 'En ligne', variant: 'default' as const, className: 'bg-green-500/20 text-green-400 border-green-500/30' },
  offline: { icon: WifiOff, label: 'Hors ligne', variant: 'secondary' as const, className: 'bg-red-500/20 text-red-400 border-red-500/30' },
  paused: { icon: Pause, label: 'En pause', variant: 'outline' as const, className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  unknown: { icon: HelpCircle, label: 'Inconnu', variant: 'outline' as const, className: 'bg-muted text-muted-foreground' },
};

function formatMemory(memoryMb: number): string {
  if (memoryMb >= 1024) {
    return `${(memoryMb / 1024).toFixed(1)} GB`;
  }
  return `${memoryMb} MB`;
}

export function RunnersTable() {
  const { data: runners, isLoading, error } = useRunners();
  const { data: infrastructures } = useInfrastructures();
  const deleteRunner = useDeleteRunner();
  const [runnerToDelete, setRunnerToDelete] = useState<{ id: string; name: string } | null>(null);

  const getInfraName = (infraId: string | null) => {
    if (!infraId || !infrastructures) return null;
    const infra = infrastructures.find(i => i.id === infraId);
    return infra?.name || null;
  };

  const handleDelete = () => {
    if (runnerToDelete) {
      deleteRunner.mutate(runnerToDelete.id);
      setRunnerToDelete(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-400">
        <p>Erreur lors du chargement des runners</p>
        <p className="text-sm text-muted-foreground mt-2">{error.message}</p>
      </div>
    );
  }

  if (!runners || runners.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Server className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>Aucun runner enregistré</p>
        <p className="text-sm mt-2">
          Installez un runner sur votre serveur pour commencer
        </p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nom</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead>Infrastructure</TableHead>
            <TableHead>Système</TableHead>
            <TableHead>Ressources</TableHead>
            <TableHead>Dernière activité</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runners.map((runner) => {
            const config = statusConfig[runner.status as keyof typeof statusConfig] || statusConfig.unknown;
            const StatusIcon = config.icon;
            const hostInfo = runner.host_info as HostInfo | null;
            
            return (
              <TableRow key={runner.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-primary" />
                    <div>
                      <div>{runner.name}</div>
                      {hostInfo?.hostname && hostInfo.hostname !== runner.name && (
                        <div className="text-xs text-muted-foreground">{hostInfo.hostname}</div>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={config.className}>
                    <StatusIcon className="w-3 h-3 mr-1" />
                    {config.label}
                  </Badge>
                </TableCell>
                <TableCell>
                  {runner.infrastructure_id ? (
                    <Link 
                      to="/infra" 
                      className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
                    >
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                      <span>{getInfraName(runner.infrastructure_id) || 'Non trouvée'}</span>
                    </Link>
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {hostInfo?.os || hostInfo?.arch ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-2 text-sm">
                          <MonitorSmartphone className="w-4 h-4 text-muted-foreground" />
                          <span className="font-mono">
                            {hostInfo.os || '?'} / {hostInfo.arch || '?'}
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="text-xs space-y-1">
                          <div>OS: {hostInfo.os || 'Inconnu'}</div>
                          <div>Arch: {hostInfo.arch || 'Inconnue'}</div>
                          {hostInfo.kernel && <div>Kernel: {hostInfo.kernel}</div>}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {(hostInfo?.cpus || hostInfo?.memory_mb) ? (
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      {hostInfo.cpus && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-1">
                              <Cpu className="w-3.5 h-3.5" />
                              <span>{hostInfo.cpus}</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>{hostInfo.cpus} CPU(s)</TooltipContent>
                        </Tooltip>
                      )}
                      {hostInfo.memory_mb && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-1">
                              <HardDrive className="w-3.5 h-3.5" />
                              <span>{formatMemory(hostInfo.memory_mb)}</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>{formatMemory(hostInfo.memory_mb)} RAM</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {runner.last_seen_at 
                    ? formatDistanceToNow(new Date(runner.last_seen_at), { 
                        addSuffix: true, 
                        locale: fr 
                      })
                    : 'Jamais'
                  }
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <RunnerDiagnostics runner={runner} />
                    <TestOrderButton 
                      runnerId={runner.id} 
                      runnerName={runner.name}
                      disabled={runner.status !== 'online'}
                    />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => setRunnerToDelete({ id: runner.id, name: runner.name })}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Supprimer le runner</TooltipContent>
                    </Tooltip>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <AlertDialog open={!!runnerToDelete} onOpenChange={() => setRunnerToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le runner ?</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer le runner <strong>{runnerToDelete?.name}</strong> ? 
              Cette action est irréversible.
              <br /><br />
              <span className="text-yellow-500">
                N'oubliez pas d'exécuter le script de désinstallation sur le serveur :
              </span>
              <code className="block mt-2 p-2 bg-muted rounded text-xs">
                curl -sSL [API_URL]/uninstall-runner.sh | bash
              </code>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
