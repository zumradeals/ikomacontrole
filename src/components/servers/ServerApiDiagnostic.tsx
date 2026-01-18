import { useState } from 'react';
import { Stethoscope, Check, X, Loader2, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { listServers, listRunners, updateServerRunner, getProxyLogs, clearProxyLogs } from '@/lib/api/ordersAdminProxy';

interface EndpointStatus {
  endpoint: string;
  method: string;
  status: 'pending' | 'success' | 'error' | 'not_found';
  statusCode?: number;
  error?: string;
  duration?: number;
}

export function ServerApiDiagnostic() {
  const [open, setOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<EndpointStatus[]>([]);
  const [logsExpanded, setLogsExpanded] = useState(false);

  const runDiagnostic = async () => {
    setTesting(true);
    clearProxyLogs();
    const newResults: EndpointStatus[] = [];

    // Test GET /servers
    const start1 = Date.now();
    try {
      const serversResult = await listServers();
      newResults.push({
        endpoint: '/servers',
        method: 'GET',
        status: serversResult.success ? 'success' : (serversResult.statusCode === 404 ? 'not_found' : 'error'),
        statusCode: serversResult.statusCode || (serversResult.success ? 200 : undefined),
        error: serversResult.error,
        duration: Date.now() - start1,
      });
    } catch (err) {
      newResults.push({
        endpoint: '/servers',
        method: 'GET',
        status: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
        duration: Date.now() - start1,
      });
    }

    // Test GET /runners
    const start2 = Date.now();
    try {
      const runnersResult = await listRunners();
      newResults.push({
        endpoint: '/runners',
        method: 'GET',
        status: runnersResult.success ? 'success' : (runnersResult.statusCode === 404 ? 'not_found' : 'error'),
        statusCode: runnersResult.statusCode || (runnersResult.success ? 200 : undefined),
        error: runnersResult.error,
        duration: Date.now() - start2,
      });
    } catch (err) {
      newResults.push({
        endpoint: '/runners',
        method: 'GET',
        status: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
        duration: Date.now() - start2,
      });
    }

    // Test PATCH /servers/:id (dry run with fake ID)
    const start3 = Date.now();
    try {
      const patchResult = await updateServerRunner('test-diagnostic-id', null);
      newResults.push({
        endpoint: '/servers/:id',
        method: 'PATCH',
        status: patchResult.success ? 'success' : (patchResult.statusCode === 404 ? 'not_found' : 'error'),
        statusCode: patchResult.statusCode,
        error: patchResult.error,
        duration: Date.now() - start3,
      });
    } catch (err) {
      newResults.push({
        endpoint: '/servers/:id',
        method: 'PATCH',
        status: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
        duration: Date.now() - start3,
      });
    }

    setResults(newResults);
    setTesting(false);
  };

  const logs = getProxyLogs();
  const allSuccess = results.length > 0 && results.every(r => r.status === 'success');
  const hasErrors = results.some(r => r.status === 'error' || r.status === 'not_found');

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="glass-panel rounded-lg border border-border/50">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between p-4 h-auto"
          >
            <div className="flex items-center gap-2">
              <Stethoscope className="w-4 h-4 text-primary" />
              <span className="font-medium">Diagnostic API Serveurs</span>
              {results.length > 0 && (
                <Badge 
                  variant={allSuccess ? 'default' : 'destructive'}
                  className={cn(
                    allSuccess && 'bg-emerald-500/10 text-emerald-500'
                  )}
                >
                  {allSuccess ? 'OK' : hasErrors ? 'Erreurs' : 'En cours'}
                </Badge>
              )}
            </div>
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="p-4 pt-0 space-y-4">
            <div className="flex items-center gap-2">
              <Button 
                size="sm" 
                onClick={runDiagnostic} 
                disabled={testing}
              >
                {testing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Test en cours...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Tester les endpoints
                  </>
                )}
              </Button>
            </div>

            {results.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Résultats</h4>
                <div className="space-y-1">
                  {results.map((r, i) => (
                    <div 
                      key={i} 
                      className={cn(
                        'flex items-center justify-between p-2 rounded text-sm',
                        r.status === 'success' && 'bg-emerald-500/10',
                        r.status === 'error' && 'bg-destructive/10',
                        r.status === 'not_found' && 'bg-amber-500/10',
                        r.status === 'pending' && 'bg-muted'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {r.status === 'success' && <Check className="w-4 h-4 text-emerald-500" />}
                        {r.status === 'error' && <X className="w-4 h-4 text-destructive" />}
                        {r.status === 'not_found' && <X className="w-4 h-4 text-amber-500" />}
                        {r.status === 'pending' && <Loader2 className="w-4 h-4 animate-spin" />}
                        <span className="font-mono text-xs">
                          {r.method} {r.endpoint}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        {r.statusCode && (
                          <Badge variant="outline" className="text-xs">
                            {r.statusCode}
                          </Badge>
                        )}
                        {r.duration && (
                          <span className="text-muted-foreground">{r.duration}ms</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {hasErrors && (
                  <p className="text-xs text-muted-foreground mt-2">
                    ⚠️ Certains endpoints ne sont pas disponibles. 
                    L'API Orders doit implémenter GET/POST/PATCH /servers.
                  </p>
                )}
              </div>
            )}

            {/* Proxy Logs */}
            {logs.length > 0 && (
              <Collapsible open={logsExpanded} onOpenChange={setLogsExpanded}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between">
                    <span>Logs proxy ({logs.length})</span>
                    {logsExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 max-h-48 overflow-y-auto bg-muted/50 rounded p-2">
                    {logs.map((log, i) => (
                      <div key={i} className="text-xs font-mono py-1 border-b border-border/30 last:border-0">
                        <span className="text-muted-foreground">
                          {log.timestamp.toLocaleTimeString()}
                        </span>
                        {' '}
                        <span className={cn(
                          log.success ? 'text-emerald-500' : 'text-destructive'
                        )}>
                          [{log.statusCode || '?'}]
                        </span>
                        {' '}
                        <span>{log.action}</span>
                        {log.error && (
                          <span className="text-destructive block pl-4">→ {log.error}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
