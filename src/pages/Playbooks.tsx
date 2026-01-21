import { useState, useMemo, useCallback } from 'react';
import { 
  Terminal, 
  AlertTriangle, 
  Scan, 
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
  WifiOff
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ServerSelector } from '@/components/platform/ServerSelector';
import { AutoDetectDialog } from '@/components/infra/AutoDetectDialog';
import { CustomOrderDialog } from '@/components/infra/CustomOrderDialog';
import { usePlaybookServices } from '@/hooks/usePlaybookServices';
import { useCreateOrder, OrderCategory } from '@/hooks/useOrders';
import { PLAYBOOK_GROUPS, Playbook, PlaybookPrerequisite, ALL_PLAYBOOKS } from '@/lib/playbooks';
import { toast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

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

function checkPrerequisites(
  prerequisites: PlaybookPrerequisite[],
  capabilities: Record<string, string>
): { met: boolean; missing: string[] } {
  const missing: string[] = [];
  
  for (const prereq of prerequisites) {
    if (prereq.required) {
      const status = capabilities[prereq.capability];
      if (status !== 'installed' && status !== 'verified') {
        missing.push(prereq.label);
      }
    }
  }
  
  return { met: missing.length === 0, missing };
}

interface PlaybookCardGridProps {
  playbook: Playbook;
  capabilities: Record<string, string>;
  onExecute: (playbook: Playbook) => void;
  isLoading: boolean;
  disabled: boolean;
  isEnabled: boolean;
  onToggle: (id: string, enabled: boolean) => void;
}

function PlaybookCardGrid({ 
  playbook, 
  capabilities, 
  onExecute, 
  isLoading, 
  disabled,
  isEnabled,
  onToggle
}: PlaybookCardGridProps) {
  const Icon = playbook.icon;
  const { met, missing } = checkPrerequisites(playbook.prerequisites, capabilities);
  
  return (
    <div className={`
      relative flex flex-col p-4 rounded-xl 
      bg-card border border-border/50 
      hover:border-primary/30 transition-all duration-200
      ${!isEnabled ? 'opacity-50' : ''}
      ${!met && isEnabled ? 'border-amber-500/30' : ''}
    `}>
      {/* Toggle in top right */}
      <div className="absolute top-3 right-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => onToggle(playbook.id, !isEnabled)}
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
          <h4 className="font-medium text-sm leading-tight truncate">{playbook.name}</h4>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${riskColors[playbook.risk]}`}>
              {riskLabels[playbook.risk]}
            </Badge>
            {playbook.level === 'expert' && (
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
      
      {/* Prerequisites warning */}
      {!met && isEnabled && (
        <div className="flex items-start gap-1.5 mb-3 text-[10px] text-amber-400 bg-amber-500/5 rounded-md p-2">
          <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
          <span className="line-clamp-2">Prérequis: {missing.join(', ')}</span>
        </div>
      )}
      
      {/* Footer */}
      <div className="flex items-center justify-between mt-auto pt-2 border-t border-border/50">
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Clock className="w-3 h-3" />
          {playbook.duration}
        </div>
        <Button 
          size="sm" 
          variant={met && isEnabled ? "default" : "outline"}
          onClick={() => onExecute(playbook)}
          disabled={isLoading || !met || disabled || !isEnabled}
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
  );
}

const Playbooks = () => {
  const [selectedServerId, setSelectedServerId] = useState<string | undefined>();
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [autoDetectDialogOpen, setAutoDetectDialogOpen] = useState(false);
  const [customOrderDialogOpen, setCustomOrderDialogOpen] = useState(false);
  const [showExpert, setShowExpert] = useState(false);
  const [activeGroup, setActiveGroup] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [enabledPlaybooks, setEnabledPlaybooks] = useState<Set<string>>(() => {
    return new Set(ALL_PLAYBOOKS.map(p => p.id));
  });

  const {
    servers,
    runnersById,
    selectedServer,
    associatedRunner,
    orders,
    gating,
  } = usePlaybookServices(selectedServerId);

  const createOrder = useCreateOrder();

  // Parse capabilities from runner hostInfo or use empty object
  // TODO: Capabilities should come from API in future
  const capabilities = useMemo(() => {
    return {} as Record<string, string>;
  }, []);

  // Map playbook group to order category
  const getCategory = (group: string): OrderCategory => {
    const categoryMap: Record<string, OrderCategory> = {
      system: 'detection',
      network: 'security',
      runtime: 'installation',
      docker: 'installation',
      redis: 'installation',
      proxy: 'installation',
      monitoring: 'installation',
      supabase: 'installation',
      maintenance: 'maintenance',
    };
    return categoryMap[group] || 'maintenance';
  };

  const handleExecute = async (playbook: Playbook) => {
    if (!associatedRunner) {
      toast({
        title: 'Erreur',
        description: 'Aucun agent associé à ce serveur',
        variant: 'destructive',
      });
      return;
    }

    setExecutingId(playbook.id);
    try {
      await createOrder.mutateAsync({
        runner_id: associatedRunner.id,
        server_id: selectedServerId,
        category: getCategory(playbook.group),
        name: playbook.name,
        description: `[${playbook.id}] ${playbook.description}`,
        command: playbook.command,
      });
      toast({
        title: 'Playbook lancé',
        description: `${playbook.name} en cours d'exécution`,
      });
    } finally {
      setExecutingId(null);
    }
  };

  const handleToggle = useCallback((id: string, enabled: boolean) => {
    setEnabledPlaybooks(prev => {
      const next = new Set(prev);
      if (enabled) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  // Filter playbooks
  const filteredPlaybooks = useMemo(() => {
    let result = ALL_PLAYBOOKS;
    
    if (activeGroup !== 'all') {
      result = result.filter(p => p.group === activeGroup);
    }
    
    if (!showExpert) {
      result = result.filter(p => p.level === 'simple');
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p => 
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        p.id.toLowerCase().includes(query)
      );
    }
    
    return result;
  }, [activeGroup, showExpert, searchQuery]);

  // Count stats
  const stats = useMemo(() => {
    const enabled = filteredPlaybooks.filter(p => enabledPlaybooks.has(p.id)).length;
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
        <TabsList className="glass-panel p-1">
          <TabsTrigger value="catalog">
            Catalogue
            <Badge variant="secondary" className="ml-2 text-xs">
              {stats.enabled}/{stats.total}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="custom">Custom</TabsTrigger>
          <TabsTrigger value="history">Historique</TabsTrigger>
        </TabsList>

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
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!isRunnerReady}
                    onClick={() => setAutoDetectDialogOpen(true)}
                  >
                    <Scan className="w-4 h-4 mr-2" />
                    Auto-détection
                  </Button>
                  
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
                    Tous ({ALL_PLAYBOOKS.filter(p => showExpert || p.level === 'simple').length})
                  </button>
                  {Object.entries(PLAYBOOK_GROUPS).map(([key, group]) => {
                    const count = group.playbooks.filter(p => showExpert || p.level === 'simple').length;
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
                </div>
              </ScrollArea>

              {/* Playbook grid */}
              {filteredPlaybooks.length === 0 ? (
                <div className="glass-panel rounded-xl p-8 text-center text-muted-foreground">
                  Aucun playbook trouvé
                  {searchQuery && ` pour "${searchQuery}"`}
                  {!showExpert && " en mode simple"}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredPlaybooks.map(playbook => (
                    <PlaybookCardGrid
                      key={playbook.id}
                      playbook={playbook}
                      capabilities={capabilities}
                      onExecute={handleExecute}
                      isLoading={executingId === playbook.id}
                      disabled={!isRunnerReady}
                      isEnabled={enabledPlaybooks.has(playbook.id)}
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
    </div>
  );
};

export default Playbooks;
