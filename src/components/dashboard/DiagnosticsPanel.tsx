/**
 * Diagnostics Panel Component
 * 
 * Aligné sur le moteur IKOMA:
 * - Champ ServerId
 * - Bouton "Run SYSTEM.diagnostics"
 * - Affichage du rapport v1 (summary, steps, artifacts)
 */

import { useState, useEffect, useRef } from 'react';
import { Play, RefreshCw, CheckCircle2, XCircle, AlertCircle, StopCircle, Clock, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { runDiagnostics, getOrder, type IkomaOrder, type ReportV1, type ReportV1Step } from '@/lib/api/ikomaApi';
import { listServers, type ProxyServer } from '@/lib/api/ordersAdminProxy';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function DiagnosticsPanel() {
  const [serverId, setServerId] = useState('');
  const [servers, setServers] = useState<ProxyServer[]>([]);
  const [loadingServers, setLoadingServers] = useState(false);
  const [running, setRunning] = useState(false);
  const [polling, setPolling] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<IkomaOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Charger la liste des serveurs au montage
  useEffect(() => {
    async function loadServers() {
      setLoadingServers(true);
      const result = await listServers();
      if (result.success && result.data) {
        // Contract: admin-proxy returns { items: [...] }
        const items = result.data.items ?? [];
        setServers(items);
        // Pré-sélectionner le premier serveur si disponible
        if (items.length > 0 && !serverId) {
          setServerId(items[0].id);
        }
      }
      setLoadingServers(false);
    }
    loadServers();
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  const handleRunDiagnostics = async () => {
    if (!serverId.trim()) {
      toast.error('Veuillez sélectionner ou saisir un Server ID');
      return;
    }

    setError(null);
    setRunning(true);
    setCurrentOrder(null);

    const result = await runDiagnostics(serverId.trim());

    if (!result.success) {
      setError(result.error?.message || 'Erreur lors du lancement des diagnostics');
      setRunning(false);
      toast.error(result.error?.message || 'Erreur');
      return;
    }

    setCurrentOrder(result.data!);
    toast.success(`Ordre créé: ${result.data!.id}`);

    // Démarrer le polling jusqu'à SUCCEEDED/FAILED
    startPolling(result.data!.id);
  };

  const startPolling = (orderId: string) => {
    setPolling(true);
    
    pollingRef.current = setInterval(async () => {
      const orderResult = await getOrder(orderId);
      
      if (!orderResult.success) {
        console.warn('Polling error:', orderResult.error);
        return;
      }

      setCurrentOrder(orderResult.data!);

      const status = orderResult.data!.status;
      if (status === 'SUCCEEDED' || status === 'FAILED' || status === 'CANCELLED') {
        stopPolling();
        setRunning(false);
        
        if (status === 'SUCCEEDED') {
          toast.success('Diagnostics terminés avec succès');
        } else if (status === 'FAILED') {
          toast.error('Diagnostics échoués');
        }
      }
    }, 2000);
  };

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setPolling(false);
    setRunning(false);
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof Clock; label: string; className?: string }> = {
      QUEUED: { variant: 'secondary', icon: Clock, label: 'En attente' },
      RUNNING: { variant: 'default', icon: RefreshCw, label: 'En cours' },
      SUCCEEDED: { variant: 'default', icon: CheckCircle2, label: 'Succès', className: 'bg-success text-success-foreground' },
      FAILED: { variant: 'destructive', icon: XCircle, label: 'Échec' },
      CANCELLED: { variant: 'outline', icon: StopCircle, label: 'Annulé' },
    };

    const cfg = config[status] || config.QUEUED;
    const Icon = cfg.icon;

    return (
      <Badge variant={cfg.variant} className={cn('gap-1', cfg.className)}>
        <Icon className={cn('w-3 h-3', status === 'RUNNING' && 'animate-spin')} />
        {cfg.label}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="w-5 h-5 text-primary" />
          SYSTEM.diagnostics
        </CardTitle>
        <CardDescription>
          Exécuter un diagnostic système complet sur un serveur
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Server Selection */}
        <div className="flex gap-4 items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="serverId">Server ID</Label>
            {servers.length > 0 ? (
              <Select value={serverId} onValueChange={setServerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un serveur" />
                </SelectTrigger>
                <SelectContent>
                  {servers.map((server) => (
                    <SelectItem key={server.id} value={server.id}>
                      {server.name} ({server.id.slice(0, 8)}...)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="serverId"
                placeholder="UUID du serveur"
                value={serverId}
                onChange={(e) => setServerId(e.target.value)}
                disabled={running}
              />
            )}
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleRunDiagnostics}
              disabled={running || !serverId.trim()}
            >
              {running ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Exécution...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Run Diagnostics
                </>
              )}
            </Button>
            {polling && (
              <Button variant="outline" onClick={stopPolling}>
                <StopCircle className="w-4 h-4 mr-2" />
                Stop
              </Button>
            )}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Order Status */}
        {currentOrder && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  Order ID: <code className="text-xs">{currentOrder.id}</code>
                </p>
                {currentOrder.requestId && (
                  <p className="text-xs text-muted-foreground">
                    Request ID: {currentOrder.requestId}
                  </p>
                )}
              </div>
              {getStatusBadge(currentOrder.status)}
            </div>

            {/* Report Display */}
            {currentOrder.report && (
              <ReportDisplay report={currentOrder.report} />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// Report Display Component
// ============================================

interface ReportDisplayProps {
  report: ReportV1;
}

function ReportDisplay({ report }: ReportDisplayProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  return (
    <div className="space-y-4 border rounded-lg p-4">
      {/* Summary Badge */}
      <div className="flex items-center justify-between">
        <Badge 
          variant={report.ok ? 'default' : 'destructive'} 
          className={cn('text-lg py-1 px-3', report.ok && 'bg-success text-success-foreground')}
        >
          {report.ok ? '✓ OK' : '✗ FAIL'}
        </Badge>
        {report.durationMs && (
          <span className="text-sm text-muted-foreground">
            Durée: {formatDuration(report.durationMs)}
          </span>
        )}
      </div>

      {/* Summary Text */}
      {report.summary && (
        <p className="text-sm bg-muted p-3 rounded-lg">{report.summary}</p>
      )}

      {/* Steps Table */}
      {report.steps.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">Étapes</h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.steps.map((step, idx) => (
                <StepRow key={idx} step={step} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Public Artifacts */}
      {Object.keys(report.artifacts.public).length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">Public Artifacts</h4>
          <div className="bg-muted rounded-lg p-3 space-y-1">
            {Object.entries(report.artifacts.public).map(([key, value]) => (
              <div key={key} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{key}:</span>
                <span className="font-mono">{String(value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Errors */}
      {report.errors.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2 text-destructive">Erreurs</h4>
          <div className="space-y-2">
            {report.errors.map((err, idx) => (
              <div key={idx} className="bg-destructive/10 p-3 rounded-lg">
                <p className="text-sm font-medium text-destructive">[{err.code}]</p>
                <p className="text-sm">{err.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Internal Artifacts (Advanced) */}
      {Object.keys(report.artifacts.internal).length > 0 && (
        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between">
              <span>Avancé (Internal Artifacts)</span>
              <ChevronDown className={cn('w-4 h-4 transition-transform', advancedOpen && 'rotate-180')} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto mt-2">
              {JSON.stringify(report.artifacts.internal, null, 2)}
            </pre>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

// ============================================
// Step Row Component
// ============================================

function StepRow({ step }: { step: ReportV1Step }) {
  const statusConfig = {
    SUCCESS: { icon: CheckCircle2, className: 'text-success' },
    FAILED: { icon: XCircle, className: 'text-destructive' },
    RUNNING: { icon: RefreshCw, className: 'text-primary animate-spin' },
    PENDING: { icon: Clock, className: 'text-muted-foreground' },
    SKIPPED: { icon: AlertCircle, className: 'text-muted-foreground' },
  };

  const cfg = statusConfig[step.status] || statusConfig.PENDING;
  const Icon = cfg.icon;

  return (
    <TableRow>
      <TableCell className="font-medium">{step.name}</TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Icon className={cn('w-4 h-4', cfg.className)} />
          <span className="text-xs">{step.status}</span>
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {step.durationMs ? formatDuration(step.durationMs) : '-'}
      </TableCell>
      <TableCell className="text-destructive text-xs max-w-[200px] truncate">
        {step.error || '-'}
      </TableCell>
    </TableRow>
  );
}

// ============================================
// Helpers
// ============================================

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}m ${secs}s`;
}
