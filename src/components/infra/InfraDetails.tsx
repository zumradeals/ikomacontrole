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
  GitBranch,
  Container,
  Shield,
  Globe,
  Network,
  Lock,
  RotateCcw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Infrastructure, useAssociateRunner } from '@/hooks/useInfrastructures';
import { useSettings } from '@/hooks/useSettings';
import { PlaybookCatalog } from './PlaybookCatalog';
import { AutoDetectDialog } from './AutoDetectDialog';
import { OrdersHistory } from './OrdersHistory';
import { CustomOrderDialog } from './CustomOrderDialog';
import { ReinstallScript } from '@/components/runner/ReinstallScript';
import { RunnerLogs } from '@/components/runner/RunnerLogs';
import { formatDistanceToNow, format } from 'date-fns';
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

interface CapabilityCardProps {
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  available: boolean | null;
}

function CapabilityCard({ icon, label, sublabel, available }: CapabilityCardProps) {
  const getBorderClass = () => {
    if (available === true) return 'border-green-500/50 bg-green-500/5';
    if (available === false) return 'border-red-500/30 bg-red-500/5';
    return 'border-border/50 bg-muted/20';
  };

  const getStatusText = () => {
    if (available === true) return { text: '✓ Disponible', class: 'text-green-400' };
    if (available === false) return { text: '✗ Non disponible', class: 'text-red-400' };
    return { text: 'Non spécifié', class: 'text-muted-foreground' };
  };

  const status = getStatusText();

  return (
    <div className={`p-4 rounded-lg border ${getBorderClass()} transition-colors`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="text-primary">{icon}</div>
          <div>
            <p className="font-medium text-primary">{label}</p>
            <p className="text-xs text-muted-foreground">{sublabel}</p>
          </div>
        </div>
        <span className={`text-xs font-medium ${status.class}`}>
          {status.text}
        </span>
      </div>
    </div>
  );
}

export function InfraDetails({ infrastructure, runners, onBack, onEdit, onDelete }: InfraDetailsProps) {
  const associateRunner = useAssociateRunner();
  const { getSetting } = useSettings();
  const [selectedRunner, setSelectedRunner] = useState<string>('');
  const [ordersDialogOpen, setOrdersDialogOpen] = useState(false);
  const [autoDetectDialogOpen, setAutoDetectDialogOpen] = useState(false);
  const [reinstallDialogOpen, setReinstallDialogOpen] = useState(false);
  const [customOrderDialogOpen, setCustomOrderDialogOpen] = useState(false);
  const [selectedRunnerForReinstall, setSelectedRunnerForReinstall] = useState<Runner | null>(null);
  
  const apiBaseUrl = getSetting('runner_base_url');

  const TypeIcon = typeIcons[infrastructure.type] || HardDrive;
  const caps = (infrastructure.capabilities as Record<string, unknown>) || {};
  
  // Get associated runners for this infrastructure
  const associatedRunners = runners.filter(r => r.infrastructure_id === infrastructure.id);
  const availableRunners = runners.filter(r => !r.infrastructure_id);

  const handleAssociate = () => {
    if (selectedRunner) {
      associateRunner.mutate({ runnerId: selectedRunner, infrastructureId: infrastructure.id });
      setSelectedRunner('');
    }
  };

  const handleDissociate = (runnerId: string) => {
    associateRunner.mutate({ runnerId, infrastructureId: null });
  };

  // Parse capabilities
  const getCapValue = (key: string): boolean | null => {
    const val = caps[key];
    if (val === true) return true;
    if (val === false) return false;
    return null;
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
              {infrastructure.architecture && (
                <>
                  <span className="hidden sm:inline">•</span>
                  <span className="hidden sm:inline">{infrastructure.architecture}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Actions - scrollable on mobile */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
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

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          {/* Resources Section */}
          <section className="glass-panel rounded-xl p-4 sm:p-6">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 sm:mb-4">
              Ressources
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
              <div className="flex items-center gap-2 sm:gap-3">
                <Cpu className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">CPU</p>
                  <p className="font-medium text-sm sm:text-base truncate">
                    {infrastructure.cpu_cores ? `${infrastructure.cpu_cores} cores` : '—'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <MemoryStick className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">RAM</p>
                  <p className="font-medium text-sm sm:text-base truncate">
                    {infrastructure.ram_gb ? `${infrastructure.ram_gb} Go` : '—'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <HardDriveIcon className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Disque</p>
                  <p className="font-medium text-sm sm:text-base truncate">
                    {infrastructure.disk_gb ? `${infrastructure.disk_gb} Go` : '—'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Localisation</p>
                  <p className="font-medium text-sm sm:text-base truncate">
                    {(caps.location as string) || '—'}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Capabilities Section */}
          <section className="glass-panel rounded-xl p-4 sm:p-6">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 sm:mb-4">
              Capacités
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
              <CapabilityCard
                icon={<GitBranch className="w-4 h-4 sm:w-5 sm:h-5" />}
                label="Git"
                sublabel="Déclaré"
                available={getCapValue('git')}
              />
              <CapabilityCard
                icon={<Container className="w-4 h-4 sm:w-5 sm:h-5" />}
                label="Docker"
                sublabel="Déclaré"
                available={getCapValue('docker')}
              />
              <CapabilityCard
                icon={<Shield className="w-4 h-4 sm:w-5 sm:h-5" />}
                label="Accès root"
                sublabel="Déclaré"
                available={getCapValue('root_access')}
              />
              <CapabilityCard
                icon={<Container className="w-4 h-4 sm:w-5 sm:h-5" />}
                label="Docker Compose"
                sublabel="Déclaré"
                available={getCapValue('docker_compose')}
              />
              <CapabilityCard
                icon={<Lock className="w-4 h-4 sm:w-5 sm:h-5" />}
                label="HTTPS possible"
                sublabel="Déclaré"
                available={getCapValue('https_possible')}
              />
              <CapabilityCard
                icon={<Network className="w-4 h-4 sm:w-5 sm:h-5" />}
                label="Ports exposables"
                sublabel="Déclaré"
                available={getCapValue('exposable_ports')}
              />
              <CapabilityCard
                icon={<Globe className="w-4 h-4 sm:w-5 sm:h-5" />}
                label="Accès Internet sortant"
                sublabel="Déclaré"
                available={getCapValue('internet_access')}
              />
            </div>
          </section>

          {/* Runners Section */}
          <section className="glass-panel rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Runners associés
              </h2>
              
              {availableRunners.length > 0 && (
                <div className="flex items-center gap-2">
                  <Select value={selectedRunner} onValueChange={setSelectedRunner}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Associer un runner" />
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
                          {runner.status} • {runner.last_seen_at 
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
                        Réinstaller
                      </Button>
                      <Button asChild variant="ghost" size="sm">
                        <Link to="/runner">
                          <ExternalLink className="w-4 h-4 mr-1" />
                          Voir
                        </Link>
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleDissociate(runner.id)}
                        disabled={associateRunner.isPending}
                        className="text-destructive hover:text-destructive"
                      >
                        Dissocier
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Server className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Aucun runner associé à cette infrastructure</p>
                {availableRunners.length === 0 && (
                  <p className="text-xs mt-1">Tous les runners sont déjà associés à d'autres infrastructures.</p>
                )}
              </div>
            )}
          </section>

          {/* Runner Logs Section */}
          {associatedRunners.length > 0 && (
            <section className="glass-panel rounded-xl p-6">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                Activité du runner
              </h2>
              <RunnerLogs runner={associatedRunners[0]} />
            </section>
          )}

          {/* Orders History Section */}
          {associatedRunners.length > 0 && (
            <section className="glass-panel rounded-xl p-6">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                Historique des ordres
              </h2>
              <OrdersHistory 
                runnerId={associatedRunners[0].id} 
                infrastructureId={infrastructure.id}
              />
            </section>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Info Card */}
          <div className="glass-panel rounded-xl p-6">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Informations
            </h3>
            <div className="space-y-3 text-sm">
              {infrastructure.distribution && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Distribution</span>
                  <span className="font-medium">{infrastructure.distribution}</span>
                </div>
              )}
              {caps.provider && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fournisseur</span>
                  <span className="font-medium">{caps.provider as string}</span>
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

          {/* Notes */}
          {infrastructure.notes && (
            <div className="glass-panel rounded-xl p-6">
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

      {/* Playbook Catalog */}
      {associatedRunners.length > 0 && (
        <PlaybookCatalog
          open={ordersDialogOpen}
          onOpenChange={setOrdersDialogOpen}
          runner={associatedRunners[0]}
          infrastructureId={infrastructure.id}
          capabilities={infrastructure.capabilities as Record<string, unknown>}
        />
      )}

      {/* Auto Detect Dialog */}
      {associatedRunners.length > 0 && (
        <AutoDetectDialog
          open={autoDetectDialogOpen}
          onOpenChange={setAutoDetectDialogOpen}
          runner={associatedRunners[0]}
          infrastructureId={infrastructure.id}
        />
      )}

      {/* Reinstall Dialog */}
      {selectedRunnerForReinstall && (
        <ReinstallScript
          open={reinstallDialogOpen}
          onOpenChange={setReinstallDialogOpen}
          runner={selectedRunnerForReinstall}
          baseUrl={apiBaseUrl}
        />
      )}

      {/* Custom Order Dialog */}
      {associatedRunners.length > 0 && (
        <CustomOrderDialog
          open={customOrderDialogOpen}
          onOpenChange={setCustomOrderDialogOpen}
          runner={associatedRunners[0]}
          infrastructureId={infrastructure.id}
        />
      )}
    </div>
  );
}