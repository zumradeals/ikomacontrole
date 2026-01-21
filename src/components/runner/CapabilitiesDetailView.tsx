/**
 * CAPABILITIES DETAIL VIEW
 * 
 * Displays detailed runner capabilities with:
 * - Current capabilities status
 * - Detection history from orders
 * - Manual re-verification button
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Clock,
  Package,
  Search,
  History,
  Cpu,
  Container,
  Globe,
  Database,
  Shield,
  Terminal,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { useCreateOrder } from '@/hooks/useOrders';
import { 
  parseRunnerCapabilities, 
  getCapabilityLabel,
  type RunnerCapabilities 
} from '@/hooks/useRunnerCapabilities';
import { AUTO_DISCOVERY_COMMAND } from '@/hooks/useCapabilitySync';
import { formatDistanceToNow, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from '@/hooks/use-toast';

interface CapabilitiesDetailViewProps {
  runnerId: string;
  runnerName: string;
  capabilities: unknown;
  onClose?: () => void;
}

// Capability category icons
const CATEGORY_ICONS: Record<string, React.ElementType> = {
  system: Cpu,
  docker: Container,
  node: Terminal,
  network: Globe,
  database: Database,
  security: Shield,
  default: Package,
};

// Type for capability group items
type CapabilityItem = { key: string; status: string };
type CapabilityGroups = Record<string, CapabilityItem[]>;

// Group capabilities by category
function groupCapabilities(caps: RunnerCapabilities): CapabilityGroups {
  const groups: CapabilityGroups = {
    system: [],
    docker: [],
    node: [],
    network: [],
    database: [],
    security: [],
    other: [],
  };
  
  for (const [key, status] of Object.entries(caps)) {
    if (!status) continue;
    
    const category = key.split('.')[0];
    const groupKey = groups[category] ? category : 'other';
    groups[groupKey].push({ key, status });
  }
  
  // Remove empty groups
  return Object.fromEntries(
    Object.entries(groups).filter(([, items]) => items.length > 0)
  );
}

// Detection history item
interface DetectionHistoryItem {
  id: string;
  name: string;
  status: string;
  exitCode: number | null;
  createdAt: string;
  completedAt: string | null;
  capabilities: string[];
}

export function CapabilitiesDetailView({
  runnerId,
  runnerName,
  capabilities,
  onClose,
}: CapabilitiesDetailViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [historyExpanded, setHistoryExpanded] = useState(true);
  
  const createOrder = useCreateOrder();
  const parsedCaps = parseRunnerCapabilities(capabilities);
  const groupedCaps = groupCapabilities(parsedCaps);
  
  // Fetch detection history from orders
  const { data: detectionHistory, isLoading: historyLoading, refetch: refetchHistory } = useQuery({
    queryKey: ['detection-history', runnerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('runner_id', runnerId)
        .in('category', ['detection', 'installation'])
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      
      return (data || []).map((order): DetectionHistoryItem => {
        // Extract detected capabilities from result or stdout
        const extractedCaps: string[] = [];
        const result = order.result as Record<string, unknown> | null;
        
        if (result?.capabilities && typeof result.capabilities === 'object') {
          extractedCaps.push(...Object.keys(result.capabilities as Record<string, unknown>));
        }
        
        return {
          id: order.id,
          name: order.name,
          status: order.status,
          exitCode: order.exit_code,
          createdAt: order.created_at,
          completedAt: order.completed_at,
          capabilities: extractedCaps,
        };
      });
    },
  });
  
  // Handle re-verification
  const handleReVerify = async () => {
    try {
      await createOrder.mutateAsync({
        runner_id: runnerId,
        category: 'detection',
        name: 'Re-vérification capacités',
        description: 'Détection manuelle des capacités installées',
        command: AUTO_DISCOVERY_COMMAND,
      });
      
      toast({
        title: 'Vérification lancée',
        description: 'La détection des capacités est en cours...',
      });
      
      // Refetch history after a delay
      setTimeout(() => refetchHistory(), 2000);
    } catch (error) {
      console.error('Failed to start verification:', error);
    }
  };
  
  // Filter capabilities by search
  const filteredGroups: CapabilityGroups = searchQuery
    ? Object.fromEntries(
        Object.entries(groupedCaps)
          .map(([group, items]) => [
            group,
            items.filter(
              item =>
                item.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
                getCapabilityLabel(item.key).toLowerCase().includes(searchQuery.toLowerCase())
            ),
          ] as [string, CapabilityItem[]])
          .filter(([, items]) => (items as CapabilityItem[]).length > 0)
      ) as CapabilityGroups
    : groupedCaps;
  
  const totalCapabilities = Object.values(parsedCaps).filter(Boolean).length;
  const installedCount = Object.values(parsedCaps).filter(v => v === 'installed' || v === 'verified').length;
  
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            Capacités de {runnerName}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {installedCount} / {totalCapabilities} capacités installées
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReVerify}
            disabled={createOrder.isPending}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${createOrder.isPending ? 'animate-spin' : ''}`} />
            Re-vérifier
          </Button>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              Fermer
            </Button>
          )}
        </div>
      </div>
      
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher une capacité..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>
      
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="glass-panel">
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold text-green-500">{installedCount}</div>
            <div className="text-xs text-muted-foreground">Installées</div>
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold text-yellow-500">
              {Object.values(parsedCaps).filter(v => v === 'checking').length}
            </div>
            <div className="text-xs text-muted-foreground">En cours</div>
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold text-red-500">
              {Object.values(parsedCaps).filter(v => v === 'failed' || v === 'not_installed').length}
            </div>
            <div className="text-xs text-muted-foreground">Non installées</div>
          </CardContent>
        </Card>
      </div>
      
      {/* Capabilities by Group */}
      <div className="space-y-4">
        {Object.keys(filteredGroups).map((group) => {
          const items = filteredGroups[group];
          const Icon = CATEGORY_ICONS[group] || CATEGORY_ICONS.default;
          
          return (
            <Card key={group} className="glass-panel">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Icon className="w-4 h-4 text-primary" />
                  <span className="capitalize">{group}</span>
                  <Badge variant="secondary" className="ml-auto">
                    {items.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid gap-2">
                  {items.map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {item.status === 'installed' || item.status === 'verified' ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : item.status === 'checking' ? (
                          <RefreshCw className="w-4 h-4 text-yellow-500 animate-spin" />
                        ) : item.status === 'failed' ? (
                          <XCircle className="w-4 h-4 text-red-500" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-muted-foreground" />
                        )}
                        <span className="text-sm font-medium">
                          {getCapabilityLabel(item.key)}
                        </span>
                        <code className="text-xs text-muted-foreground">{item.key}</code>
                      </div>
                      <Badge
                        variant={
                          item.status === 'installed' || item.status === 'verified'
                            ? 'default'
                            : item.status === 'checking'
                            ? 'secondary'
                            : 'outline'
                        }
                        className={
                          item.status === 'installed' || item.status === 'verified'
                            ? 'bg-green-500/20 text-green-500 border-green-500/30'
                            : item.status === 'failed'
                            ? 'bg-red-500/20 text-red-500 border-red-500/30'
                            : ''
                        }
                      >
                        {item.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
        
        {Object.keys(filteredGroups).length === 0 && (
          <Card className="glass-panel">
            <CardContent className="py-8 text-center text-muted-foreground">
              {searchQuery ? (
                <p>Aucune capacité trouvée pour "{searchQuery}"</p>
              ) : (
                <>
                  <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>Aucune capacité détectée</p>
                  <p className="text-xs mt-1">
                    Lancez une auto-découverte pour détecter les logiciels installés
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReVerify}
                    disabled={createOrder.isPending}
                    className="mt-4"
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${createOrder.isPending ? 'animate-spin' : ''}`} />
                    Lancer l'auto-découverte
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
      
      <Separator />
      
      {/* Detection History */}
      <Collapsible open={historyExpanded} onOpenChange={setHistoryExpanded}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
            <div className="flex items-center gap-2 text-sm font-medium">
              <History className="w-4 h-4" />
              Historique des détections
            </div>
            {historyExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent className="mt-4">
          {historyLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : detectionHistory && detectionHistory.length > 0 ? (
            <div className="space-y-2">
              {detectionHistory.map(item => (
                <Card key={item.id} className="glass-panel">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-2">
                        {item.status === 'completed' && item.exitCode === 0 ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5" />
                        ) : item.status === 'running' ? (
                          <RefreshCw className="w-4 h-4 text-yellow-500 animate-spin mt-0.5" />
                        ) : item.status === 'pending' ? (
                          <Clock className="w-4 h-4 text-muted-foreground mt-0.5" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-500 mt-0.5" />
                        )}
                        <div>
                          <p className="text-sm font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(item.createdAt), {
                              addSuffix: true,
                              locale: fr,
                            })}
                          </p>
                          {item.capabilities.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {item.capabilities.slice(0, 5).map(cap => (
                                <Badge key={cap} variant="outline" className="text-xs">
                                  {cap}
                                </Badge>
                              ))}
                              {item.capabilities.length > 5 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{item.capabilities.length - 5}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge
                          variant={
                            item.status === 'completed'
                              ? 'default'
                              : item.status === 'running'
                              ? 'secondary'
                              : 'outline'
                          }
                          className={
                            item.status === 'completed' && item.exitCode === 0
                              ? 'bg-green-500/20 text-green-500'
                              : item.status === 'failed' || (item.status === 'completed' && item.exitCode !== 0)
                              ? 'bg-red-500/20 text-red-500'
                              : ''
                          }
                        >
                          {item.status}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="glass-panel">
              <CardContent className="py-6 text-center text-muted-foreground">
                <History className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Aucun historique de détection</p>
              </CardContent>
            </Card>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
