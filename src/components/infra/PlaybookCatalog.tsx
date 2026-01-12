import { useState, useMemo } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription 
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  AlertTriangle, 
  Clock, 
  Loader2,
  CheckCircle2,
  XCircle,
  Play,
  ChevronRight,
  Filter
} from 'lucide-react';
import { 
  PLAYBOOK_GROUPS, 
  Playbook, 
  PlaybookLevel,
  PlaybookPrerequisite 
} from '@/lib/playbooks';
import { useCreateOrder, OrderCategory } from '@/hooks/useOrders';
import { Json } from '@/integrations/supabase/types';

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

interface PlaybookCardProps {
  playbook: Playbook;
  capabilities: Record<string, string>;
  onExecute: (playbook: Playbook) => void;
  isLoading: boolean;
}

function PlaybookCard({ playbook, capabilities, onExecute, isLoading }: PlaybookCardProps) {
  const Icon = playbook.icon;
  const { met, missing } = checkPrerequisites(playbook.prerequisites, capabilities);
  
  return (
    <div className={`
      flex items-start justify-between p-4 rounded-lg 
      bg-muted/30 border border-border/50 
      hover:border-primary/30 transition-colors
      ${!met ? 'opacity-70' : ''}
    `}>
      <div className="flex items-start gap-3 flex-1">
        <div className="text-primary mt-0.5">
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-medium">{playbook.name}</h4>
            <Badge variant="outline" className={riskColors[playbook.risk]}>
              {riskLabels[playbook.risk]}
            </Badge>
            {playbook.level === 'expert' && (
              <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30">
                Expert
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">{playbook.description}</p>
          
          {!met && (
            <div className="flex items-center gap-1 mt-2 text-xs text-amber-400">
              <AlertTriangle className="w-3 h-3 flex-shrink-0" />
              <span>Prérequis manquants : {missing.join(', ')}</span>
            </div>
          )}
          
          {playbook.verifies.length > 0 && met && (
            <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
              <CheckCircle2 className="w-3 h-3 flex-shrink-0 text-green-500" />
              <span>Vérifie : {playbook.verifies.join(', ')}</span>
            </div>
          )}
        </div>
      </div>
      
      <div className="flex flex-col items-end gap-2 ml-4">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          {playbook.duration}
        </div>
        <Button 
          size="sm" 
          variant={met ? "default" : "outline"}
          onClick={() => onExecute(playbook)}
          disabled={isLoading || !met}
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

  // Parse capabilities from JSON
  const capabilities = useMemo(() => {
    if (!rawCapabilities) return {};
    if (typeof rawCapabilities === 'object' && !Array.isArray(rawCapabilities)) {
      return rawCapabilities as Record<string, string>;
    }
    return {};
  }, [rawCapabilities]);

  // Map playbook group to order category
  const getCategory = (group: string): OrderCategory => {
    const categoryMap: Record<string, OrderCategory> = {
      system: 'detection',
      network: 'security',
      runtime: 'installation',
      docker: 'installation',
      proxy: 'installation',
      monitoring: 'installation',
      supabase: 'installation',
      maintenance: 'maintenance',
    };
    return categoryMap[group] || 'maintenance';
  };

  const handleExecute = async (playbook: Playbook) => {
    setExecutingId(playbook.id);
    try {
      await createOrder.mutateAsync({
        runner_id: runner.id,
        infrastructure_id: infrastructureId,
        category: getCategory(playbook.group),
        name: playbook.name,
        description: `[${playbook.id}] ${playbook.description}`,
        command: playbook.command,
      });
      // Close dialog after successful order creation
      onOpenChange(false);
    } finally {
      setExecutingId(null);
    }
  };

  const filteredPlaybooks = useMemo(() => {
    const group = PLAYBOOK_GROUPS[activeGroup as keyof typeof PLAYBOOK_GROUPS];
    if (!group) return [];
    
    return group.playbooks.filter(p => showExpert || p.level === 'simple');
  }, [activeGroup, showExpert]);

  const isRunnerOnline = runner.status === 'online';

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

        <div className="flex flex-1 min-h-0">
          {/* Group sidebar */}
          <div className="w-48 border-r border-border/50 p-2 flex-shrink-0">
            <ScrollArea className="h-[calc(90vh-200px)]">
              <div className="space-y-1">
                {Object.entries(PLAYBOOK_GROUPS).map(([key, group]) => {
                  const GroupIcon = group.icon;
                  const playbookCount = showExpert 
                    ? group.playbooks.length 
                    : group.playbooks.filter(p => p.level === 'simple').length;
                  
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
            </ScrollArea>
          </div>

          {/* Playbook list */}
          <div className="flex-1 min-w-0">
            <ScrollArea className="h-[calc(90vh-200px)] p-4">
              <div className="space-y-3">
                {filteredPlaybooks.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    Aucun playbook dans cette catégorie
                    {!showExpert && " (mode simple)"}
                  </div>
                ) : (
                  filteredPlaybooks.map(playbook => (
                    <PlaybookCard
                      key={playbook.id}
                      playbook={playbook}
                      capabilities={capabilities}
                      onExecute={handleExecute}
                      isLoading={executingId === playbook.id}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
