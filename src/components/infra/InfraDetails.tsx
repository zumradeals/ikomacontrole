import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Pencil, 
  Trash2, 
  Cpu, 
  MemoryStick, 
  HardDrive as HardDriveIcon, 
  MapPin,
  Server,
  Cloud,
  HardDrive,
  ExternalLink,
  RotateCcw,
  Activity,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Package,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Infrastructure } from '@/hooks/useInfrastructures';
import { useProxyAssociateRunner } from '@/hooks/useProxyRunners';
import { useSettings } from '@/hooks/useSettings';
import { useInstalledCapabilities, GROUP_DISPLAY } from '@/hooks/useInstalledCapabilities';
import { ReinstallScript } from '@/components/runner/ReinstallScript';
import { RunnerLogs } from '@/components/runner/RunnerLogs';
import { OrdersHistory } from './OrdersHistory';
import { formatDistanceToNow, format, differenceInSeconds } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Runner {
  id: string;
  name: string;
  status: string;
  infrastructure_id: string | null;
  last_seen_at: string | null;
  host_info: Record<string, unknown> | null;
}

interface InfraDetailsProps {
  infrastructure: Infrastructure;
  runners: Runner[];
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const typeIcons = {
  vps: Server,
  bare_metal: HardDrive,
  cloud: Cloud,
};

const typeLabels = {
  vps: 'VPS',
  bare_metal: 'Bare Metal',
  cloud: 'Cloud',
};

const statusColors: Record<string, string> = {
  online: 'bg-green-500',
  offline: 'bg-muted-foreground/50',
  paused: 'bg-yellow-500',
  unknown: 'bg-muted-foreground/30',
};

// Health Dashboard Component
function HealthDashboard({ runner, infrastructure }: { runner: Runner | null; infrastructure: Infrastructure }) {
  const isOnline = runner?.status === 'online';
  const lastSeen = runner?.last_seen_at ? new Date(runner.last_seen_at) : null;
  const secondsAgo = lastSeen ? differenceInSeconds(new Date(), lastSeen) : null;
  
  const getHealthScore = () => {
    if (!runner) return 0;
    if (!isOnline) return 25;
    if (secondsAgo && secondsAgo > 120) return 50;
    return 100;
  };

  const healthScore = getHealthScore();
  const healthColor = healthScore >= 80 ? 'text-green-500' : healthScore >= 50 ? 'text-yellow-500' : 'text-red-500';
  const progressColor = healthScore >= 80 ? 'bg-green-500' : healthScore >= 50 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="glass-panel rounded-xl p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Activity className="w-4 h-4" />
          Santé du serveur
        </h2>
        <span className={`text-2xl font-bold ${healthColor}`}>{healthScore}%</span>
      </div>
      
      <Progress value={healthScore} className={`h-2 mb-4 [&>div]:${progressColor}`} />
      
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Runner Status */}
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${runner ? statusColors[runner.status] : 'bg-muted-foreground/30'}`} />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Agent</p>
            <p className="font-medium text-sm truncate">
              {runner ? (isOnline ? 'En ligne' : 'Hors ligne') : 'Non associé'}
            </p>
          </div>
        </div>
        
        {/* Last Heartbeat */}
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Dernier signal</p>
            <p className="font-medium text-sm truncate">
              {lastSeen 
                ? formatDistanceToNow(lastSeen, { addSuffix: true, locale: fr })
                : '—'
              }
            </p>
          </div>
        </div>

        {/* Resources */}
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">CPU / RAM</p>
            <p className="font-medium text-sm truncate">
              {infrastructure.cpu_cores || '?'} cores / {infrastructure.ram_gb || '?'} Go
            </p>
          </div>
        </div>

        {/* Disk */}
        <div className="flex items-center gap-2">
          <HardDriveIcon className="w-4 h-4 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Disque</p>
            <p className="font-medium text-sm truncate">
              {infrastructure.disk_gb ? `${infrastructure.disk_gb} Go` : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {(!runner || !isOnline) && (
        <div className="mt-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
            <div className="text-sm">
              {!runner ? (
                <p>Aucun agent associé. <Link to="/runner" className="text-primary underline">Installer un agent</Link> pour gérer ce serveur.</p>
              ) : (
                <p>L'agent est hors ligne depuis {lastSeen ? formatDistanceToNow(lastSeen, { locale: fr }) : 'un moment'}. Vérifiez la connexion.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Installed Software Badges
function InstalledSoftware({ infrastructureId, runnerId }: { infrastructureId: string; runnerId?: string }) {
  const { data, isLoading, refetch } = useInstalledCapabilities(infrastructureId, runnerId);
  
  if (isLoading) {
    return (
      <div className="glass-panel rounded-xl p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Package className="w-4 h-4" />
            Logiciels installés
          </h2>
        </div>
        <div className="flex gap-2 flex-wrap">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-8 w-24 bg-muted/50 rounded-full animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const capabilities = data?.capabilities || [];
  const summary = data?.summary;

  return (
    <div className="glass-panel rounded-xl p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Package className="w-4 h-4" />
          Logiciels installés
          {summary && summary.total > 0 && (
            <Badge variant="secondary" className="ml-2">{summary.total}</Badge>
          )}
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/playbooks">
              Installer plus
              <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </Button>
        </div>
      </div>

      {capabilities.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Aucun logiciel vérifié</p>
          <p className="text-xs mt-1">
            Exécutez des playbooks pour détecter et installer des logiciels
          </p>
          <Button variant="outline" size="sm" className="mt-4" asChild>
            <Link to="/playbooks">
              Ouvrir le catalogue
              <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </Button>
        </div>
      ) : (
        <>
          {/* Summary badges */}
          {summary && (
            <div className="flex items-center gap-4 mb-4 text-sm">
              <div className="flex items-center gap-1.5 text-green-500">
                <CheckCircle2 className="w-4 h-4" />
                <span>{summary.active} actifs</span>
              </div>
              {summary.stale > 0 && (
                <div className="flex items-center gap-1.5 text-yellow-500">
                  <AlertTriangle className="w-4 h-4" />
                  <span>{summary.stale} à revérifier</span>
                </div>
              )}
              {summary.failed > 0 && (
                <div className="flex items-center gap-1.5 text-red-500">
                  <XCircle className="w-4 h-4" />
                  <span>{summary.failed} échecs</span>
                </div>
              )}
            </div>
          )}

          {/* Grouped badges */}
          <div className="space-y-3">
            {Object.entries(summary?.byGroup || {}).map(([group, caps]) => (
              <div key={group}>
                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${GROUP_DISPLAY[group]?.color || 'bg-gray-500'}`} />
                  {GROUP_DISPLAY[group]?.label || group}
                </p>
                <div className="flex gap-2 flex-wrap">
                  {caps.map(cap => (
                    <Badge
                      key={cap.id}
                      variant={cap.status === 'active' ? 'default' : 'secondary'}
                      className={`
                        ${cap.status === 'active' ? 'bg-green-500/20 text-green-400 border-green-500/30' : ''}
                        ${cap.status === 'stale' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' : ''}
                        ${cap.status === 'failed' ? 'bg-red-500/20 text-red-400 border-red-500/30' : ''}
                      `}
                    >
                      {cap.status === 'active' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                      {cap.status === 'stale' && <AlertTriangle className="w-3 h-3 mr-1" />}
                      {cap.status === 'failed' && <XCircle className="w-3 h-3 mr-1" />}
                      {cap.name}
                      {cap.version && <span className="ml-1 opacity-70">v{cap.version}</span>}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function InfraDetails({ infrastructure, runners, onBack, onEdit, onDelete }: InfraDetailsProps) {
  const associateRunner = useProxyAssociateRunner();
  const { getSetting } = useSettings();
  const [selectedRunner, setSelectedRunner] = useState<string>('');
  const [reinstallDialogOpen, setReinstallDialogOpen] = useState(false);
  const [selectedRunnerForReinstall, setSelectedRunnerForReinstall] = useState<Runner | null>(null);
  
  const apiBaseUrl = getSetting('runner_base_url');

  const TypeIcon = typeIcons[infrastructure.type] || HardDrive;
  const caps = (infrastructure.capabilities as Record<string, unknown>) || {};
  
  const associatedRunners = runners.filter(r => r.infrastructure_id === infrastructure.id);
  const availableRunners = runners.filter(r => !r.infrastructure_id);
  const primaryRunner = associatedRunners[0] || null;

  const handleAssociate = () => {
    if (selectedRunner) {
      associateRunner.mutate({ runnerId: selectedRunner, infrastructureId: infrastructure.id });
      setSelectedRunner('');
    }
  };

  const handleDissociate = (runnerId: string) => {
    associateRunner.mutate({ runnerId, infrastructureId: null });
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="p-2 sm:p-3 rounded-xl bg-primary/10 border border-primary/20 shrink-0">
            <TypeIcon className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-bold truncate">{infrastructure.name}</h1>
            <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground flex-wrap">
              <span>{typeLabels[infrastructure.type]}</span>
              {infrastructure.os && (
                <>
                  <span>•</span>
                  <span>{infrastructure.os}</span>
                </>
              )}
              {infrastructure.distribution && (
                <>
                  <span className="hidden sm:inline">•</span>
                  <span className="hidden sm:inline">{infrastructure.distribution}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 -mx-4 px-4 sm:mx-0 sm:px-0">
          <Button variant="outline" size="sm" onClick={onEdit} className="shrink-0">
            <Pencil className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Modifier</span>
          </Button>
          <Button variant="outline" size="sm" onClick={onDelete} className="text-destructive hover:text-destructive shrink-0">
            <Trash2 className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Supprimer</span>
          </Button>
        </div>
      </div>

      {/* Health Dashboard */}
      <HealthDashboard runner={primaryRunner} infrastructure={infrastructure} />

      {/* Installed Software */}
      <InstalledSoftware 
        infrastructureId={infrastructure.id} 
        runnerId={primaryRunner?.id}
      />

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          {/* Runners Section */}
          <section className="glass-panel rounded-xl p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Agents associés
              </h2>
              
              {availableRunners.length > 0 && (
                <div className="flex items-center gap-2">
                  <Select value={selectedRunner} onValueChange={setSelectedRunner}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Associer un agent" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRunners.map(runner => (
                        <SelectItem key={runner.id} value={runner.id}>
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${statusColors[runner.status]}`} />
                            {runner.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedRunner && (
                    <Button 
                      size="sm" 
                      onClick={handleAssociate}
                      disabled={associateRunner.isPending}
                    >
                      Associer
                    </Button>
                  )}
                </div>
              )}
            </div>

            {associatedRunners.length > 0 ? (
              <div className="space-y-3">
                {associatedRunners.map(runner => (
                  <div 
                    key={runner.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full ${statusColors[runner.status]}`} />
                      <div>
                        <p className="font-medium">{runner.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {runner.status === 'online' ? 'En ligne' : 'Hors ligne'} • {runner.last_seen_at 
                            ? format(new Date(runner.last_seen_at), "dd/MM/yyyy HH:mm:ss", { locale: fr })
                            : 'Jamais vu'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => {
                          setSelectedRunnerForReinstall(runner);
                          setReinstallDialogOpen(true);
                        }}
                      >
                        <RotateCcw className="w-4 h-4 mr-1" />
                        <span className="hidden sm:inline">Réinstaller</span>
                      </Button>
                      <Button asChild variant="ghost" size="sm">
                        <Link to="/runner">
                          <ExternalLink className="w-4 h-4 sm:mr-1" />
                          <span className="hidden sm:inline">Voir</span>
                        </Link>
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleDissociate(runner.id)}
                        disabled={associateRunner.isPending}
                        className="text-destructive hover:text-destructive"
                      >
                        <span className="hidden sm:inline">Dissocier</span>
                        <span className="sm:hidden">×</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Server className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Aucun agent associé à ce serveur</p>
                {availableRunners.length === 0 && (
                  <p className="text-xs mt-1">Créez un agent dans la page <Link to="/runner" className="text-primary underline">Agents</Link>.</p>
                )}
              </div>
            )}
          </section>

          {/* Activity Tabs - Combined Logs & History */}
          {associatedRunners.length > 0 && (
            <section className="glass-panel rounded-xl p-4 sm:p-6">
              <Tabs defaultValue="history">
                <TabsList className="mb-4">
                  <TabsTrigger value="history">Historique</TabsTrigger>
                  <TabsTrigger value="logs">Logs</TabsTrigger>
                </TabsList>
                
                <TabsContent value="history" className="mt-0">
                  <OrdersHistory 
                    runnerId={associatedRunners[0].id} 
                    infrastructureId={infrastructure.id}
                  />
                </TabsContent>
                
                <TabsContent value="logs" className="mt-0">
                  <RunnerLogs runner={associatedRunners[0]} />
                </TabsContent>
              </Tabs>
            </section>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4 sm:space-y-6">
          {/* Info Card */}
          <div className="glass-panel rounded-xl p-4 sm:p-6">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Informations
            </h3>
            <div className="space-y-3 text-sm">
              {infrastructure.architecture && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Architecture</span>
                  <span className="font-medium">{infrastructure.architecture}</span>
                </div>
              )}
              {caps.location && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Localisation</span>
                  <span className="font-medium flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {caps.location as string}
                  </span>
                </div>
              )}
              {caps.provider && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fournisseur</span>
                  <span className="font-medium">{caps.provider as string}</span>
                </div>
              )}
              {caps.root_domain && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Domaine</span>
                  <span className="font-medium text-xs truncate max-w-32">{caps.root_domain as string}</span>
                </div>
              )}
              <Separator className="my-3" />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Créé le</span>
                <span className="font-medium">
                  {format(new Date(infrastructure.created_at), "dd/MM/yyyy", { locale: fr })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Modifié</span>
                <span className="font-medium">
                  {formatDistanceToNow(new Date(infrastructure.updated_at), { addSuffix: true, locale: fr })}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="glass-panel rounded-xl p-4 sm:p-6">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Actions rapides
            </h3>
            <div className="space-y-2">
              <Button 
                variant="outline" 
                className="w-full justify-start" 
                asChild
                disabled={!primaryRunner || primaryRunner.status !== 'online'}
              >
                <Link to="/playbooks">
                  <Package className="w-4 h-4 mr-2" />
                  Ouvrir le catalogue
                </Link>
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                disabled={!primaryRunner}
                onClick={() => {
                  if (primaryRunner) {
                    setSelectedRunnerForReinstall(primaryRunner);
                    setReinstallDialogOpen(true);
                  }
                }}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Réinstaller l'agent
              </Button>
            </div>
          </div>

          {/* Notes */}
          {infrastructure.notes && (
            <div className="glass-panel rounded-xl p-4 sm:p-6">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                Notes
              </h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {infrastructure.notes}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Reinstall Dialog */}
      {selectedRunnerForReinstall && (
        <ReinstallScript
          open={reinstallDialogOpen}
          onOpenChange={setReinstallDialogOpen}
          runner={selectedRunnerForReinstall}
          baseUrl={apiBaseUrl}
        />
      )}
    </div>
  );
}
