import { useState, useMemo, useCallback } from 'react';
import { 
  Terminal, 
  AlertTriangle, 
  Code,
  Play,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Power,
  PowerOff,
  Search,
  Server,
  Wifi,
  WifiOff,
  Shield,
  RefreshCw,
  Settings,
  Globe,
  HardDrive,
  Database,
  Zap,
  AlertCircle,
  Plus,
  Info,
  Sparkles,
  History
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ServerSelector } from '@/components/platform/ServerSelector';
import { AutoDetectDialog } from '@/components/infra/AutoDetectDialog';
import { CustomOrderDialog } from '@/components/infra/CustomOrderDialog';
import { PlaybookExecutionTracker } from '@/components/playbooks/PlaybookExecutionTracker';
import { PlaybookCreateForm } from '@/components/playbooks/PlaybookCreateForm';
import { PlaybookDetailSheet } from '@/components/playbooks/PlaybookDetailSheet';
import { PlaybookExecuteDialog } from '@/components/playbooks/PlaybookExecuteDialog';
import { PlaybookWizard } from '@/components/playbooks/PlaybookWizard';
import { PlaybookVersionHistory } from '@/components/playbooks/PlaybookVersionHistory';
import { usePlaybookServices } from '@/hooks/usePlaybookServices';
import { useCreateOrder, OrderCategory } from '@/hooks/useOrders';
import { usePlaybooks, PlaybookItem } from '@/hooks/usePlaybooks';
import { useLocalPlaybooksList, type LocalPlaybook } from '@/hooks/usePlaybookGovernance';
import { getCapabilityLabel } from '@/hooks/useRunnerCapabilities';
import { toast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// Risk mapping based on visibility
const visibilityRiskMap: Record<string, 'low' | 'medium' | 'high'> = {
  public: 'low',
  internal: 'medium',
};

const riskColors = {
  low: 'bg-green-500/10 text-green-400 border-green-500/30',
  medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  high: 'bg-red-500/10 text-red-400 border-red-500/30',
};

const riskLabels = {
  low: 'Faible',
  medium: 'Modéré',
  high: 'Élevé',
};

// Icon mapping based on playbook key prefix
function getPlaybookIcon(key: string) {
  if (key.startsWith('system.')) return Terminal;
  if (key.startsWith('security.')) return Shield;
  if (key.startsWith('docker.')) return HardDrive;
  if (key.startsWith('network.')) return Globe;
  if (key.startsWith('database.')) return Database;
  if (key.startsWith('runtime.')) return Zap;
  return Settings;
}

// Extract group from playbook key (e.g., "system.test_ping" -> "system")
function getPlaybookGroup(key: string): string {
  const parts = key.split('.');
  return parts[0] || 'other';
}

// Group configuration with icons and labels
const GROUP_CONFIG: Record<string, { label: string; icon: typeof Terminal }> = {
  system: { label: 'Système', icon: Terminal },
  security: { label: 'Sécurité', icon: Shield },
  docker: { label: 'Docker', icon: HardDrive },
  network: { label: 'Réseau', icon: Globe },
  database: { label: 'Base de données', icon: Database },
  runtime: { label: 'Runtime', icon: Zap },
  other: { label: 'Autres', icon: Settings },
};

interface PlaybookCardGridProps {
  playbook: PlaybookItem;
  capabilities: Record<string, string>;
  onExecute: (playbook: PlaybookItem) => void;
  onDetails: (playbook: PlaybookItem) => void;
  isLoading: boolean;
  disabled: boolean;
  isEnabled: boolean;
  onToggle: (key: string, enabled: boolean) => void;
}

function PlaybookCardGrid({ 
  playbook, 
  capabilities, 
  onExecute, 
  onDetails,
  isLoading, 
  disabled,
  isEnabled,
  onToggle
}: PlaybookCardGridProps) {
  const Icon = getPlaybookIcon(playbook.key);
  const risk = visibilityRiskMap[playbook.visibility] || 'medium';
  const isExpert = playbook.visibility === 'internal';
  
  return (
    <div className={`
      relative flex flex-col p-4 rounded-xl 
      bg-card border border-border/50 
      hover:border-primary/30 transition-all duration-200
      ${!isEnabled ? 'opacity-50' : ''}
    `}>
      {/* Toggle in top right */}
      <div className="absolute top-3 right-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => onToggle(playbook.key, !isEnabled)}
              className={`
                p-1.5 rounded-md transition-colors
                ${isEnabled 
                  ? 'text-green-400 hover:bg-green-500/10' 
                  : 'text-muted-foreground hover:bg-muted'
                }
              `}
            >
              {isEnabled ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
            </button>
          </TooltipTrigger>
          <TooltipContent>
            {isEnabled ? 'Désactiver ce playbook' : 'Activer ce playbook'}
          </TooltipContent>
        </Tooltip>
      </div>
      
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className={`
          p-2 rounded-lg 
          ${isEnabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}
        `}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0 pr-8">
          <h4 className="font-medium text-sm leading-tight truncate">{playbook.title}</h4>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${riskColors[risk]}`}>
              {riskLabels[risk]}
            </Badge>
            {isExpert && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-purple-500/10 text-purple-400 border-purple-500/30">
                Expert
              </Badge>
            )}
          </div>
        </div>
      </div>
      
      {/* Description */}
      <p className="text-xs text-muted-foreground mb-3 line-clamp-2 flex-1">
        {playbook.description}
      </p>
      
      {/* Footer */}
      <div className="flex items-center justify-between mt-auto pt-2 border-t border-border/50">
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Clock className="w-3 h-3" />
          v{playbook.version}
        </div>
        <div className="flex items-center gap-1.5">
          <Button 
            size="sm" 
            variant="ghost"
            onClick={() => onDetails(playbook)}
            className="h-7 text-xs gap-1"
          >
            <Info className="w-3 h-3" />
            Détails
          </Button>
          <Button 
            size="sm" 
            variant={isEnabled ? "default" : "outline"}
            onClick={() => onExecute(playbook)}
            disabled={isLoading || disabled || !isEnabled}
            className="h-7 text-xs gap-1"
          >
            {isLoading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Play className="w-3 h-3" />
            )}
            Exécuter
          </Button>
        </div>
      </div>
    </div>
  );
}

const Playbooks = () => {
  const [selectedServerId, setSelectedServerId] = useState<string | undefined>();
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [autoDetectDialogOpen, setAutoDetectDialogOpen] = useState(false);
  const [customOrderDialogOpen, setCustomOrderDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [wizardDialogOpen, setWizardDialogOpen] = useState(false);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [executeDialogOpen, setExecuteDialogOpen] = useState(false);
  const [selectedPlaybook, setSelectedPlaybook] = useState<PlaybookItem | null>(null);
  const [selectedLocalPlaybook, setSelectedLocalPlaybook] = useState<LocalPlaybook | null>(null);
  const [isAutoDiscovering, setIsAutoDiscovering] = useState(false);
  const [showExpert, setShowExpert] = useState(false);
  const [activeGroup, setActiveGroup] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [enabledPlaybooks, setEnabledPlaybooks] = useState<Set<string>>(new Set());

  // Fetch playbooks from API
  const { data: allPlaybooks, isLoading: isLoadingPlaybooks, error: playbooksError, refetch: refetchPlaybooks, isFetching: isRefetchingPlaybooks } = usePlaybooks();

  // Fetch local playbooks from Supabase
  const { data: localPlaybooks = [] } = useLocalPlaybooksList();

  // Initialize enabled playbooks when data loads
  useMemo(() => {
    if (allPlaybooks && enabledPlaybooks.size === 0) {
      setEnabledPlaybooks(new Set(allPlaybooks.map(p => p.key)));
    }
  }, [allPlaybooks, enabledPlaybooks.size]);

  const {
    servers,
    runnersById,
    selectedServer,
    associatedRunner,
    orders,
    gating,
    capabilities,
  } = usePlaybookServices(selectedServerId);

  const createOrder = useCreateOrder();

  // Convert capabilities to Record<string, string>
  const capabilitiesRecord = useMemo(() => {
    const record: Record<string, string> = {};
    if (capabilities) {
      for (const [key, value] of Object.entries(capabilities)) {
        if (value) record[key] = value;
      }
    }
    return record;
  }, [capabilities]);

  // Calculate groups dynamically from API playbooks
  const groups = useMemo(() => {
    if (!allPlaybooks) return {};
    
    const groupMap: Record<string, { 
      label: string; 
      icon: typeof Terminal; 
      playbooks: PlaybookItem[] 
    }> = {};
    
    for (const playbook of allPlaybooks) {
      const groupKey = getPlaybookGroup(playbook.key);
      
      if (!groupMap[groupKey]) {
        const config = GROUP_CONFIG[groupKey] || GROUP_CONFIG.other;
        groupMap[groupKey] = {
          label: config.label,
          icon: config.icon,
          playbooks: [],
        };
      }
      
      groupMap[groupKey].playbooks.push(playbook);
    }
    
    return groupMap;
  }, [allPlaybooks]);

  // Map playbook group to order category
  const getCategory = (key: string): OrderCategory => {
    const group = getPlaybookGroup(key);
    const categoryMap: Record<string, OrderCategory> = {
      system: 'detection',
      network: 'security',
      runtime: 'installation',
      docker: 'installation',
      security: 'security',
      database: 'installation',
      other: 'maintenance',
    };
    return categoryMap[group] || 'maintenance';
  };

  const handleExecute = async (playbook: PlaybookItem) => {
    if (!associatedRunner) {
      toast({
        title: 'Erreur',
        description: 'Aucun agent associé à ce serveur',
        variant: 'destructive',
      });
      return;
    }

    setExecutingId(playbook.key);
    try {
      const defaultAction = playbook.actions[0] || 'run';
      await createOrder.mutateAsync({
        runner_id: associatedRunner.id,
        server_id: selectedServerId,
        category: getCategory(playbook.key),
        name: playbook.title,
        description: `[${playbook.key}] ${playbook.description}`,
        command: `playbook:${playbook.key}:${defaultAction}`,
        playbook_key: playbook.key,
        action: defaultAction,
      });
      toast({
        title: 'Playbook lancé',
        description: `${playbook.title} en cours d'exécution`,
      });
    } finally {
      setExecutingId(null);
    }
  };

  // Quick auto-discovery function
  const handleQuickAutoDiscovery = async () => {
    if (!associatedRunner) {
      toast({
        title: 'Erreur',
        description: 'Aucun agent associé à ce serveur',
        variant: 'destructive',
      });
      return;
    }

    // Find the auto-discover playbook from API
    const discoveryPlaybook = allPlaybooks?.find(p => 
      p.key === 'system.autodiscover' || p.key === 'system.auto_discover'
    );
    
    if (!discoveryPlaybook) {
      toast({
        title: 'Erreur',
        description: 'Playbook d\'auto-découverte non trouvé dans le catalogue',
        variant: 'destructive',
      });
      return;
    }

    setIsAutoDiscovering(true);
    try {
      const defaultAction = discoveryPlaybook.actions[0] || 'run';
      await createOrder.mutateAsync({
        runner_id: associatedRunner.id,
        server_id: selectedServerId,
        category: 'detection',
        name: discoveryPlaybook.title,
        description: `[${discoveryPlaybook.key}] ${discoveryPlaybook.description}`,
        command: `playbook:${discoveryPlaybook.key}:${defaultAction}`,
        playbook_key: discoveryPlaybook.key,
        action: defaultAction,
      });
      toast({
        title: 'Auto-découverte lancée',
        description: 'Détection des logiciels installés en cours...',
      });
    } finally {
      setIsAutoDiscovering(false);
    }
  };

  const handleToggle = useCallback((key: string, enabled: boolean) => {
    setEnabledPlaybooks(prev => {
      const next = new Set(prev);
      if (enabled) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  }, []);

  // Filter playbooks
  const filteredPlaybooks = useMemo(() => {
    if (!allPlaybooks) return [];
    
    let result = allPlaybooks;
    
    if (activeGroup !== 'all') {
      result = result.filter(p => getPlaybookGroup(p.key) === activeGroup);
    }
    
    if (!showExpert) {
      result = result.filter(p => p.visibility === 'public');
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p => 
        p.title.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        p.key.toLowerCase().includes(query)
      );
    }
    
    return result;
  }, [allPlaybooks, activeGroup, showExpert, searchQuery]);

  // Count stats
  const stats = useMemo(() => {
    const enabled = filteredPlaybooks.filter(p => enabledPlaybooks.has(p.key)).length;
    return {
      total: filteredPlaybooks.length,
      enabled,
      disabled: filteredPlaybooks.length - enabled,
    };
  }, [filteredPlaybooks, enabledPlaybooks]);

  const isRunnerReady = gating.hasRunner && gating.runnerOnline;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Playbooks"
        description="Bibliothèque de scripts d'automatisation pour vos serveurs"
        icon={Terminal}
      />

      <Tabs defaultValue="catalog" className="space-y-6">
        <div className="flex items-center justify-between">
          <TabsList className="glass-panel p-1">
            <TabsTrigger value="catalog">
              Catalogue
              <Badge variant="secondary" className="ml-2 text-xs">
                {isLoadingPlaybooks ? '...' : `${stats.enabled}/${stats.total}`}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="custom">Custom</TabsTrigger>
            <TabsTrigger value="history">Historique</TabsTrigger>
          </TabsList>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchPlaybooks()}
            disabled={isRefetchingPlaybooks}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isRefetchingPlaybooks ? 'animate-spin' : ''}`} />
            Rafraîchir
          </Button>
        </div>

        {/* Server Selector */}
        <div className="glass-panel rounded-xl p-4">
          <ServerSelector
            servers={servers}
            runnersById={runnersById}
            selectedId={selectedServerId}
            onSelect={setSelectedServerId}
          />
          
          {/* Show selected server info */}
          {selectedServer && (
            <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Serveur:</span>
                <span className="font-medium">{selectedServer.name}</span>
              </div>
              {associatedRunner ? (
                <div className="flex items-center gap-2">
                  {gating.runnerOnline ? (
                    <Wifi className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <WifiOff className="w-4 h-4 text-amber-400" />
                  )}
                  <span className="text-muted-foreground">Agent:</span>
                  <span className={gating.runnerOnline ? 'text-emerald-400' : 'text-amber-400'}>
                    {associatedRunner.name}
                  </span>
                </div>
              ) : (
                <Badge variant="outline" className="text-amber-400 border-amber-500/30">
                  Aucun agent associé
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Warning if no runner */}
        {selectedServerId && !isRunnerReady && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {!gating.hasRunner 
              ? "Aucun agent associé à ce serveur. Associez un agent depuis la page Serveurs."
              : "L'agent est hors ligne. Les ordres seront exécutés à sa prochaine connexion."
            }
          </div>
        )}

        {/* API error message */}
        {playbooksError && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            Erreur lors du chargement des playbooks : {playbooksError.message}
          </div>
        )}

        {/* Real-time execution tracker */}
        {associatedRunner && orders.length > 0 && (
          <PlaybookExecutionTracker
            runnerId={associatedRunner.id}
            orders={orders}
          />
        )}

        {/* Capabilities summary */}
        {associatedRunner && Object.keys(capabilitiesRecord).length > 0 && (
          <div className="glass-panel rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">Capacités détectées</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(capabilitiesRecord)
                .filter(([_, status]) => status === 'installed' || status === 'verified')
                .slice(0, 12)
                .map(([key, status]) => (
                  <Badge 
                    key={key} 
                    variant="outline" 
                    className={status === 'verified' 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                    }
                  >
                    {status === 'verified' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                    {getCapabilityLabel(key)}
                  </Badge>
                ))}
              {Object.keys(capabilitiesRecord).length > 12 && (
                <Badge variant="outline" className="text-muted-foreground">
                  +{Object.keys(capabilitiesRecord).length - 12} autres
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Catalog Tab */}
        <TabsContent value="catalog" className="space-y-4">
          {!selectedServerId ? (
            <div className="glass-panel rounded-xl p-8 text-center">
              <Server className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Aucun serveur sélectionné</h3>
              <p className="text-muted-foreground">
                Sélectionnez un serveur pour accéder au catalogue de playbooks.
              </p>
            </div>
          ) : (
            <>
              {/* Filters bar */}
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="flex items-center gap-3 flex-wrap">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="default"
                        size="sm"
                        disabled={!isRunnerReady || isAutoDiscovering || isLoadingPlaybooks}
                        onClick={handleQuickAutoDiscovery}
                      >
                        {isAutoDiscovering ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4 mr-2" />
                        )}
                        Auto-découverte
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Détecte automatiquement Docker, Node.js, Git et autres logiciels installés
                    </TooltipContent>
                  </Tooltip>
                  
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 h-9 w-48"
                    />
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  {/* Mode Simple: Wizard */}
                  <Button
                    size="sm"
                    onClick={() => setWizardDialogOpen(true)}
                    className="gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    Nouveau (Wizard)
                  </Button>
                  
                  {/* Mode Expert: Form */}
                  {showExpert && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCreateDialogOpen(true)}
                      className="gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Mode Expert
                    </Button>
                  )}
                  
                  <div className="flex items-center gap-2">
                    <Label htmlFor="expert-mode" className="text-sm text-muted-foreground">
                      Expert
                    </Label>
                    <Switch 
                      id="expert-mode" 
                      checked={showExpert} 
                      onCheckedChange={setShowExpert}
                    />
                  </div>
                </div>
              </div>

              {/* Group filter chips */}
              <ScrollArea className="w-full">
                <div className="flex items-center gap-2 pb-2">
                  {isLoadingPlaybooks ? (
                    <div className="flex gap-2">
                      {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-8 w-24 rounded-full" />
                      ))}
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => setActiveGroup('all')}
                        className={`
                          px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap
                          ${activeGroup === 'all' 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-muted text-muted-foreground hover:text-foreground'
                          }
                        `}
                      >
                        Tous ({allPlaybooks?.filter(p => showExpert || p.visibility === 'public').length || 0})
                      </button>
                      {Object.entries(groups).map(([key, group]) => {
                        const count = group.playbooks.filter(p => showExpert || p.visibility === 'public').length;
                        if (count === 0) return null;
                        const GroupIcon = group.icon;
                        return (
                          <button
                            key={key}
                            onClick={() => setActiveGroup(key)}
                            className={`
                              flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap
                              ${activeGroup === key 
                                ? 'bg-primary text-primary-foreground' 
                                : 'bg-muted text-muted-foreground hover:text-foreground'
                              }
                            `}
                          >
                            <GroupIcon className="w-3.5 h-3.5" />
                            {group.label} ({count})
                          </button>
                        );
                      })}
                    </>
                  )}
                </div>
              </ScrollArea>

              {/* Playbook grid */}
              {isLoadingPlaybooks ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {[...Array(8)].map((_, i) => (
                    <Skeleton key={i} className="h-40 w-full rounded-xl" />
                  ))}
                </div>
              ) : filteredPlaybooks.length === 0 ? (
                <div className="glass-panel rounded-xl p-8 text-center text-muted-foreground">
                  Aucun playbook trouvé
                  {searchQuery && ` pour "${searchQuery}"`}
                  {!showExpert && " en mode simple"}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredPlaybooks.map(playbook => (
                    <PlaybookCardGrid
                      key={playbook.key}
                      playbook={playbook}
                      capabilities={capabilitiesRecord}
                      onExecute={handleExecute}
                      onDetails={(p) => {
                        setSelectedPlaybook(p);
                        setDetailSheetOpen(true);
                      }}
                      isLoading={executingId === playbook.key}
                      disabled={!isRunnerReady}
                      isEnabled={enabledPlaybooks.has(playbook.key)}
                      onToggle={handleToggle}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* Custom Tab */}
        <TabsContent value="custom" className="space-y-4">
          {!selectedServerId ? (
            <div className="glass-panel rounded-xl p-8 text-center text-muted-foreground">
              Sélectionnez un serveur pour créer des commandes personnalisées.
            </div>
          ) : (
            <div className="glass-panel rounded-xl p-6">
              <div className="flex items-start gap-4 mb-6">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Code className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Commandes personnalisées</h3>
                  <p className="text-sm text-muted-foreground">
                    Créez et exécutez des scripts shell personnalisés sur votre serveur.
                  </p>
                </div>
              </div>
              
              <Button
                onClick={() => setCustomOrderDialogOpen(true)}
                disabled={!isRunnerReady}
                className="gap-2"
              >
                <Terminal className="w-4 h-4" />
                Nouvelle commande
              </Button>
            </div>
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          {orders.length === 0 ? (
            <div className="glass-panel rounded-xl p-8 text-center text-muted-foreground">
              Aucun ordre exécuté pour ce serveur.
            </div>
          ) : (
            <div className="glass-panel rounded-xl p-4">
              <h3 className="font-semibold mb-4">Derniers ordres ({orders.length})</h3>
              <div className="space-y-2">
                {orders.slice(0, 30).map((order) => (
                  <div 
                    key={order.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{order.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(order.created_at).toLocaleString('fr-FR')}
                      </p>
                    </div>
                    <div className={`
                      flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium
                      ${order.status === 'completed' ? 'bg-green-500/10 text-green-400' : ''}
                      ${order.status === 'failed' ? 'bg-red-500/10 text-red-400' : ''}
                      ${order.status === 'running' ? 'bg-purple-500/10 text-purple-400' : ''}
                      ${order.status === 'pending' ? 'bg-muted text-muted-foreground' : ''}
                      ${order.status === 'cancelled' ? 'bg-amber-500/10 text-amber-400' : ''}
                    `}>
                      {order.status === 'completed' && <CheckCircle2 className="w-3 h-3" />}
                      {order.status === 'failed' && <XCircle className="w-3 h-3" />}
                      {order.status === 'running' && <Loader2 className="w-3 h-3 animate-spin" />}
                      {order.status}
                      {order.exit_code !== null && ` (${order.exit_code})`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Auto-detect Dialog */}
      {selectedServerId && associatedRunner && (
        <AutoDetectDialog
          open={autoDetectDialogOpen}
          onOpenChange={setAutoDetectDialogOpen}
          infrastructureId={selectedServerId}
          runner={{
            id: associatedRunner.id,
            name: associatedRunner.name,
            status: associatedRunner.status === 'ONLINE' ? 'online' : 'offline',
          }}
        />
      )}

      {/* Custom Order Dialog */}
      {selectedServerId && associatedRunner && (
        <CustomOrderDialog
          open={customOrderDialogOpen}
          onOpenChange={setCustomOrderDialogOpen}
          infrastructureId={selectedServerId}
          runner={{
            id: associatedRunner.id,
            name: associatedRunner.name,
            status: associatedRunner.status === 'ONLINE' ? 'online' : 'offline',
          }}
        />
      )}

      {/* Create Playbook Dialog (Expert Mode) */}
      <PlaybookCreateForm
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        serverId={selectedServerId}
      />

      {/* Wizard Dialog (Simple Mode) */}
      <PlaybookWizard
        open={wizardDialogOpen}
        onOpenChange={setWizardDialogOpen}
      />

      {/* Version History Sheet */}
      <PlaybookVersionHistory
        open={versionHistoryOpen}
        onOpenChange={setVersionHistoryOpen}
        playbook={selectedLocalPlaybook}
      />

      {/* Playbook Detail Sheet */}
      <PlaybookDetailSheet
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        playbookKey={selectedPlaybook?.key || null}
        onExecute={(pb) => {
          setDetailSheetOpen(false);
          setSelectedPlaybook(pb as unknown as PlaybookItem);
          setExecuteDialogOpen(true);
        }}
      />

      {/* Execute Dialog */}
      {selectedPlaybook && associatedRunner && selectedServerId && (
        <PlaybookExecuteDialog
          open={executeDialogOpen}
          onOpenChange={setExecuteDialogOpen}
          playbook={selectedPlaybook}
          serverId={selectedServerId}
          runnerId={associatedRunner.id}
          serverName={selectedServer?.name}
        />
      )}
    </div>
  );
};

export default Playbooks;
