import { useState, useMemo } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  AlertTriangle, 
  Clock, 
  Loader2,
  CheckCircle2,
  Play,
  Filter,
  Terminal,
  Settings,
  Shield,
  Database,
  Server,
  Globe,
  Zap,
  HardDrive,
  AlertCircle
} from 'lucide-react';
import { usePlaybooks, PlaybookItem } from '@/hooks/usePlaybooks';
import { useCreateOrder, OrderCategory } from '@/hooks/useOrders';

interface Runner {
  id: string;
  name: string;
  status: string;
}

interface PlaybookCatalogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  runner: Runner;
  infrastructureId?: string;
  capabilities?: Record<string, unknown>;
}

// Map visibility to risk level for UI display
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
  low: 'Risque faible',
  medium: 'Risque modéré',
  high: 'Risque élevé',
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

interface PlaybookCardProps {
  playbook: PlaybookItem;
  capabilities: Record<string, string>;
  onExecute: (playbook: PlaybookItem) => void;
  isLoading: boolean;
}

function PlaybookCard({ playbook, capabilities, onExecute, isLoading }: PlaybookCardProps) {
  const Icon = getPlaybookIcon(playbook.key);
  const risk = visibilityRiskMap[playbook.visibility] || 'medium';
  const isExpert = playbook.visibility === 'internal';
  
  return (
    <div className="flex items-start justify-between p-4 rounded-lg bg-muted/30 border border-border/50 hover:border-primary/30 transition-colors">
      <div className="flex items-start gap-3 flex-1">
        <div className="text-primary mt-0.5">
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-medium">{playbook.title}</h4>
            <Badge variant="outline" className={riskColors[risk]}>
              {riskLabels[risk]}
            </Badge>
            {isExpert && (
              <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30">
                Expert
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">{playbook.description}</p>
          
          {playbook.actions.length > 0 && (
            <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
              <CheckCircle2 className="w-3 h-3 flex-shrink-0 text-green-500" />
              <span>Actions : {playbook.actions.join(', ')}</span>
            </div>
          )}
        </div>
      </div>
      
      <div className="flex flex-col items-end gap-2 ml-4">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          v{playbook.version}
        </div>
        <Button 
          size="sm" 
          variant="default"
          onClick={() => onExecute(playbook)}
          disabled={isLoading}
          className="gap-1"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-3 h-3" />
          )}
          Exécuter
        </Button>
      </div>
    </div>
  );
}

export function PlaybookCatalog({ 
  open, 
  onOpenChange, 
  runner,
  infrastructureId,
  capabilities: rawCapabilities
}: PlaybookCatalogProps) {
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [showExpert, setShowExpert] = useState(false);
  const [activeGroup, setActiveGroup] = useState('system');
  const createOrder = useCreateOrder();

  // Fetch playbooks from API
  const { data: playbooks, isLoading, error } = usePlaybooks();

  // Parse capabilities from JSON
  const capabilities = useMemo(() => {
    if (!rawCapabilities) return {};
    if (typeof rawCapabilities === 'object' && !Array.isArray(rawCapabilities)) {
      return rawCapabilities as Record<string, string>;
    }
    return {};
  }, [rawCapabilities]);

  // Calculate groups from API playbooks
  const groups = useMemo(() => {
    if (!playbooks) return {};
    
    const groupMap: Record<string, { 
      label: string; 
      icon: typeof Terminal; 
      playbooks: PlaybookItem[] 
    }> = {};
    
    for (const playbook of playbooks) {
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
  }, [playbooks]);

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
    setExecutingId(playbook.key);
    try {
      const defaultAction = playbook.actions[0] || 'run';
      await createOrder.mutateAsync({
        runner_id: runner.id,
        server_id: infrastructureId,
        category: getCategory(playbook.key),
        name: playbook.title,
        description: `[${playbook.key}] ${playbook.description}`,
        command: `playbook:${playbook.key}:${defaultAction}`,
        playbook_key: playbook.key,
        action: defaultAction,
      });
      onOpenChange(false);
    } finally {
      setExecutingId(null);
    }
  };

  const filteredPlaybooks = useMemo(() => {
    const group = groups[activeGroup];
    if (!group) return [];
    
    return group.playbooks.filter(p => 
      showExpert || p.visibility === 'public'
    );
  }, [groups, activeGroup, showExpert]);

  const isRunnerOnline = runner.status === 'online';

  // Set default active group when playbooks load
  useMemo(() => {
    if (playbooks && playbooks.length > 0 && !groups[activeGroup]) {
      const firstGroup = getPlaybookGroup(playbooks[0].key);
      if (firstGroup !== activeGroup) {
        setActiveGroup(firstGroup);
      }
    }
  }, [playbooks, groups, activeGroup]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-primary" />
                Catalogue Playbooks
              </DialogTitle>
              <DialogDescription>
                Exécuter des playbooks sur {runner.name}
              </DialogDescription>
            </div>
            
            <div className="flex items-center gap-2">
              <Label htmlFor="expert-mode" className="text-sm text-muted-foreground">
                Mode Expert
              </Label>
              <Switch 
                id="expert-mode" 
                checked={showExpert} 
                onCheckedChange={setShowExpert}
              />
            </div>
          </div>
        </DialogHeader>

        {!isRunnerOnline && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            Le runner est hors ligne. Les ordres seront exécutés à sa prochaine connexion.
          </div>
        )}

        {error && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            Erreur lors du chargement des playbooks : {error.message}
          </div>
        )}

        <div className="flex flex-1 min-h-0">
          {/* Group sidebar */}
          <div className="w-48 border-r border-border/50 p-2 flex-shrink-0">
            <ScrollArea className="h-[calc(90vh-200px)]">
              {isLoading ? (
                <div className="space-y-2 p-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-1">
                  {Object.entries(groups).map(([key, group]) => {
                    const GroupIcon = group.icon;
                    const playbookCount = showExpert 
                      ? group.playbooks.length 
                      : group.playbooks.filter(p => p.visibility === 'public').length;
                    
                    if (playbookCount === 0) return null;
                    
                    return (
                      <button
                        key={key}
                        onClick={() => setActiveGroup(key)}
                        className={`
                          w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm
                          transition-colors text-left
                          ${activeGroup === key 
                            ? 'bg-primary/10 text-primary border border-primary/30' 
                            : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                          }
                        `}
                      >
                        <GroupIcon className="w-4 h-4 flex-shrink-0" />
                        <span className="flex-1 truncate">{group.label}</span>
                        <Badge variant="outline" className="text-xs px-1.5 py-0">
                          {playbookCount}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Playbook list */}
          <div className="flex-1 min-w-0">
            <ScrollArea className="h-[calc(90vh-200px)] p-4">
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredPlaybooks.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      Aucun playbook dans cette catégorie
                      {!showExpert && " (mode simple)"}
                    </div>
                  ) : (
                    filteredPlaybooks.map(playbook => (
                      <PlaybookCard
                        key={playbook.key}
                        playbook={playbook}
                        capabilities={capabilities}
                        onExecute={handleExecute}
                        isLoading={executingId === playbook.key}
                      />
                    ))
                  )}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
