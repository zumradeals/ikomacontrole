/**
 * Server Diagnostics Panel
 * 
 * Displays diagnostic information about a server/infrastructure:
 * - Runner association status from API
 * - Available runners (online first)
 * - Recent proxy logs
 * - Quick verification actions
 */

import { useState } from 'react';
import { 
  Bug, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Server,
  AlertTriangle,
  Copy,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { 
  useProxyRunnersV2, 
  useVerifyRunnerAssociation,
  useProxyDiagnostics,
  type ProxyRunner,
  type ProxyLogEntry
} from '@/hooks/useProxyServers';
import { formatDistanceToNow, format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ServerDiagnosticsProps {
  serverId: string;
  serverName: string;
  expectedRunnerId?: string | null;
}

function LogEntryRow({ log }: { log: ProxyLogEntry }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`p-2 rounded text-xs font-mono ${log.success ? 'bg-muted/30' : 'bg-destructive/10'}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {log.success ? (
            <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
          ) : (
            <XCircle className="w-3 h-3 text-destructive shrink-0" />
          )}
          <span className="truncate">{log.action}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {log.statusCode && (
            <Badge variant="outline" className="text-[10px]">
              {log.statusCode}
            </Badge>
          )}
          {log.duration && (
            <span className="text-muted-foreground">{log.duration}ms</span>
          )}
          <button 
            onClick={() => setExpanded(!expanded)}
            className="p-0.5 hover:bg-muted rounded"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>
      
      {expanded && (
        <div className="mt-2 pt-2 border-t border-border/50 space-y-1">
          <div><span className="text-muted-foreground">Time:</span> {format(log.timestamp, 'HH:mm:ss.SSS')}</div>
          <div><span className="text-muted-foreground">Endpoint:</span> {log.endpoint}</div>
          <div><span className="text-muted-foreground">Method:</span> {log.method}</div>
          {log.error && (
            <div className="text-destructive"><span className="text-muted-foreground">Error:</span> {log.error}</div>
          )}
        </div>
      )}
    </div>
  );
}

function RunnerListItem({ runner, serverId, isExpected }: { runner: ProxyRunner; serverId: string; isExpected: boolean }) {
  const isAttachedHere = runner.infrastructureId === serverId || runner.serverId === serverId;
  const isAttachedElsewhere = !isAttachedHere && (runner.infrastructureId || runner.serverId);
  const isOnline = runner.status === 'online';

  return (
    <div className={`p-3 rounded-lg border ${isAttachedHere ? 'border-green-500/50 bg-green-500/10' : 'border-border/50'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-muted-foreground/50'}`} />
          <span className="font-medium text-sm">{runner.name}</span>
          {isExpected && (
            <Badge variant="outline" className="text-[10px]">Attendu</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isAttachedHere && (
            <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Associé ici
            </Badge>
          )}
          {isAttachedElsewhere && (
            <Badge variant="secondary" className="text-xs">
              Autre serveur
            </Badge>
          )}
          {!runner.infrastructureId && !runner.serverId && (
            <Badge variant="outline" className="text-muted-foreground text-xs">
              Disponible
            </Badge>
          )}
        </div>
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {runner.lastHeartbeatAt 
          ? `Vu ${formatDistanceToNow(new Date(runner.lastHeartbeatAt), { addSuffix: true, locale: fr })}`
          : 'Jamais vu'
        }
        {runner.hostInfo?.hostname && ` • ${runner.hostInfo.hostname}`}
      </div>
    </div>
  );
}

export function ServerDiagnostics({ serverId, serverName, expectedRunnerId }: ServerDiagnosticsProps) {
  const [open, setOpen] = useState(false);
  const [logsExpanded, setLogsExpanded] = useState(false);
  
  const { data: runners, isLoading: runnersLoading, refetch: refetchRunners } = useProxyRunnersV2();
  const verifyMutation = useVerifyRunnerAssociation();
  const { logs, clearLogs } = useProxyDiagnostics();

  const handleVerify = async () => {
    if (!expectedRunnerId) {
      toast({
        title: 'Aucun agent attendu',
        description: 'Sélectionnez un agent à associer.',
        variant: 'destructive',
      });
      return;
    }

    const result = await verifyMutation.mutateAsync({
      runnerId: expectedRunnerId,
      expectedInfraId: serverId,
    });

    if (result.verified) {
      toast({
        title: 'Association confirmée',
        description: 'L\'API confirme l\'association.',
      });
    } else {
      toast({
        title: 'Association non confirmée',
        description: `L'API indique: infrastructureId = ${result.actualInfraId || 'null'}`,
        variant: 'destructive',
      });
    }
  };

  const handleCopyLogs = () => {
    const logText = logs.map(log => 
      `[${format(log.timestamp, 'HH:mm:ss')}] ${log.success ? '✓' : '✗'} ${log.action} (${log.statusCode || 'N/A'}) ${log.error || ''}`
    ).join('\n');
    
    navigator.clipboard.writeText(logText);
    toast({
      title: 'Logs copiés',
      description: `${logs.length} entrées copiées dans le presse-papier.`,
    });
  };

  // Sort runners: online first, then by attached status
  const sortedRunners = [...(runners || [])].sort((a, b) => {
    // Attached to this server first
    const aAttached = a.infrastructureId === serverId || a.serverId === serverId;
    const bAttached = b.infrastructureId === serverId || b.serverId === serverId;
    if (aAttached && !bAttached) return -1;
    if (!aAttached && bAttached) return 1;
    
    // Then online
    if (a.status === 'online' && b.status !== 'online') return -1;
    if (a.status !== 'online' && b.status === 'online') return 1;
    
    // Then available (no infrastructure)
    const aAvailable = !a.infrastructureId && !a.serverId;
    const bAvailable = !b.infrastructureId && !b.serverId;
    if (aAvailable && !bAvailable) return -1;
    if (!aAvailable && bAvailable) return 1;
    
    return 0;
  });

  const attachedRunner = runners?.find(r => 
    r.infrastructureId === serverId || r.serverId === serverId
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <Bug className="w-4 h-4 mr-2" />
          Diagnostic
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Bug className="w-5 h-5" />
            Diagnostic : {serverName}
          </SheetTitle>
          <SheetDescription>
            État de l'association serveur/agent selon l'API Orders
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] mt-6 pr-4">
          <div className="space-y-6">
            {/* Current Status */}
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                État actuel (API)
              </h3>
              <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                <div className="flex items-center gap-3 mb-3">
                  <Server className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{serverName}</p>
                    <p className="text-xs text-muted-foreground font-mono">{serverId}</p>
                  </div>
                </div>
                
                <Separator className="my-3" />
                
                {attachedRunner ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    <div>
                      <p className="text-sm">Agent associé : <strong>{attachedRunner.name}</strong></p>
                      <p className="text-xs text-muted-foreground">
                        Status: {attachedRunner.status} • 
                        Vu: {attachedRunner.lastHeartbeatAt 
                          ? formatDistanceToNow(new Date(attachedRunner.lastHeartbeatAt), { addSuffix: true, locale: fr })
                          : 'Jamais'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-500" />
                    <div>
                      <p className="text-sm text-yellow-500">Aucun agent associé</p>
                      <p className="text-xs text-muted-foreground">
                        Selon les données API, aucun runner n'a infrastructureId = {serverId}
                      </p>
                    </div>
                  </div>
                )}

                <div className="mt-3 flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => refetchRunners()}
                    disabled={runnersLoading}
                  >
                    <RefreshCw className={`w-4 h-4 mr-1 ${runnersLoading ? 'animate-spin' : ''}`} />
                    Rafraîchir
                  </Button>
                  {expectedRunnerId && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleVerify}
                      disabled={verifyMutation.isPending}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1" />
                      Vérifier
                    </Button>
                  )}
                </div>
              </div>
            </section>

            {/* All Runners */}
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Tous les agents ({runners?.length || 0})
              </h3>
              {runnersLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-16 bg-muted/30 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : sortedRunners.length > 0 ? (
                <div className="space-y-2">
                  {sortedRunners.map(runner => (
                    <RunnerListItem 
                      key={runner.id} 
                      runner={runner} 
                      serverId={serverId}
                      isExpected={runner.id === expectedRunnerId}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <Server className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Aucun agent trouvé dans l'API</p>
                </div>
              )}
            </section>

            {/* Proxy Logs */}
            <section>
              <Collapsible open={logsExpanded} onOpenChange={setLogsExpanded}>
                <div className="flex items-center justify-between mb-3">
                  <CollapsibleTrigger className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors">
                    {logsExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    Logs proxy ({logs.length})
                  </CollapsibleTrigger>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={handleCopyLogs} disabled={logs.length === 0}>
                      <Copy className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={clearLogs} disabled={logs.length === 0}>
                      Vider
                    </Button>
                  </div>
                </div>
                
                <CollapsibleContent>
                  {logs.length > 0 ? (
                    <div className="space-y-1 max-h-64 overflow-y-auto">
                      {logs.map((log, i) => (
                        <LogEntryRow key={i} log={log} />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                      <Clock className="w-6 h-6 mx-auto mb-2 opacity-30" />
                      Aucun log récent
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </section>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
