import { useState } from 'react';
import { Stethoscope, Check, X, Loader2, RefreshCw, ChevronDown, ChevronUp, Globe, ShieldCheck, AlertCircle } from 'lucide-react';
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
              <span className="font-medium">Diagnostic BFF (Proxy API)</span>
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
                <h4 className="text-sm font-medium">Résultats Endpoints</h4>
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
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-3 h-3" />
                      <span>Logs détaillés du Proxy ({logs.length})</span>
                    </div>
                    {logsExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 max-h-64 overflow-y-auto bg-muted/50 rounded p-2 space-y-2">
                    {logs.map((log, i) => (
                      <div key={i} className="text-[10px] font-mono py-2 border-b border-border/30 last:border-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-muted-foreground">
                            {log.timestamp.toLocaleTimeString()}
                          </span>
                          <span className={cn(
                            'px-1 rounded',
                            log.success ? 'bg-emerald-500/20 text-emerald-500' : 'bg-destructive/20 text-destructive'
                          )}>
                            HTTP {log.statusCode || '???'}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-1 mb-1">
                          <Badge variant="outline" className="text-[9px] h-4 px-1">{log.method}</Badge>
                          <span className="font-bold">{log.endpoint}</span>
                        </div>

                        {log.proxy_target && (
                          <div className="flex items-start gap-1 text-muted-foreground mt-1">
                            <Globe className="w-3 h-3 mt-0.5 flex-shrink-0" />
                            <span className="break-all">Target: {log.proxy_target}</span>
                          </div>
                        )}

                        {log.proxy_status !== undefined && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <div className={cn(
                              'w-1.5 h-1.5 rounded-full',
                              log.proxy_status >= 200 && log.proxy_status < 300 ? 'bg-emerald-500' : 'bg-destructive'
                            )} />
                            <span>API Status: {log.proxy_status}</span>
                          </div>
                        )}

                        {log.error && (
                          <div className="flex items-start gap-1 text-destructive mt-1 bg-destructive/5 p-1 rounded">
                            <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                            <span>Error: {log.error}</span>
                          </div>
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
