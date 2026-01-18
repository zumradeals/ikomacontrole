import { useState, useEffect, useRef } from 'react';
import { Terminal, Trash2, Download, Pause, Play, ChevronDown, ChevronRight, Code } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Runner {
  id: string;
  name: string;
  status: string;
  last_seen_at: string | null;
}

interface RunnerLogsProps {
  runner: Runner;
}

interface LogEntry {
  id: string;
  timestamp: Date;
  type: 'heartbeat' | 'order_pending' | 'order_execute' | 'order_complete' | 'order_fail' | 'system' | 'api_report' | 'api_error';
  message: string;
  details?: Record<string, unknown>;
  rawBody?: string;
}

// LogLine component to display a single log entry with expandable raw body
function LogLine({ 
  log, 
  getLogTypeBadge, 
  getLogTypeColor 
}: { 
  log: LogEntry; 
  getLogTypeBadge: (type: LogEntry['type']) => { label: string; variant: 'secondary' | 'outline' | 'default' | 'destructive' };
  getLogTypeColor: (type: LogEntry['type']) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = log.rawBody || (log.details && Object.keys(log.details).length > 0);
  
  return (
    <div className="hover:bg-white/5 rounded px-1 -mx-1">
      <div className="flex items-start gap-2">
        {hasDetails ? (
          <button 
            onClick={() => setExpanded(!expanded)} 
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
        ) : (
          <span className="w-3" />
        )}
        <span className="text-muted-foreground shrink-0">
          {format(log.timestamp, "HH:mm:ss", { locale: fr })}
        </span>
        <Badge 
          variant={getLogTypeBadge(log.type).variant} 
          className="text-[10px] px-1 py-0 h-4 shrink-0"
        >
          {getLogTypeBadge(log.type).label}
        </Badge>
        <span className={getLogTypeColor(log.type)}>
          {log.message}
        </span>
      </div>
      {expanded && hasDetails && (
        <div className="ml-8 mt-1 mb-2 p-2 bg-black/30 rounded border border-border/30 text-[10px]">
          {log.details && Object.keys(log.details).length > 0 && (
            <div className="mb-2">
              <div className="flex items-center gap-1 text-cyan-400 mb-1">
                <Code className="w-3 h-3" />
                <span>Parsed Data:</span>
              </div>
              <pre className="text-muted-foreground whitespace-pre-wrap break-all">
                {JSON.stringify(log.details, null, 2)}
              </pre>
            </div>
          )}
          {log.rawBody && (
            <div>
              <div className="flex items-center gap-1 text-orange-400 mb-1">
                <Terminal className="w-3 h-3" />
                <span>Raw Body:</span>
              </div>
              <pre className="text-muted-foreground whitespace-pre-wrap break-all max-h-40 overflow-auto">
                {log.rawBody}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function RunnerLogs({ runner }: RunnerLogsProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const processedOrdersRef = useRef<Set<string>>(new Set());
  const lastHeartbeatRef = useRef<string | null>(null);
  const queryClient = useQueryClient();

  // Note: We DO NOT fetch from supabase.from('runners') here anymore.
  // Instead, we use the runner prop data which comes from the proxy.
  // The runnerData query is removed to eliminate direct Supabase access to 'runners'.
  const runnerData = runner; // Use the prop directly

  // Fetch recent orders - this is OK, orders are managed locally in Supabase
  const { data: orders } = useQuery({
    queryKey: ['runner-logs-orders', runner.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('runner_id', runner.id)
        .order('updated_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data;
    },
    refetchInterval: isPaused ? false : 2000,
  });

  // Fetch API logs (reports received, parse errors, etc.) - local Supabase table
  const { data: apiLogs } = useQuery({
    queryKey: ['runner-api-logs', runner.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('runner_logs')
        .select('*')
        .eq('runner_id', runner.id)
        .order('timestamp', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data;
    },
    refetchInterval: isPaused ? false : 2000,
  });

  // Setup Realtime subscription for orders and API logs
  useEffect(() => {
    if (isPaused) return;

    const ordersChannel = supabase
      .channel(`runner-orders-${runner.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `runner_id=eq.${runner.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['runner-logs-orders', runner.id] });
        }
      )
      .subscribe();

    const logsChannel = supabase
      .channel(`runner-api-logs-${runner.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'runner_logs',
          filter: `runner_id=eq.${runner.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['runner-api-logs', runner.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(logsChannel);
    };
  }, [runner.id, isPaused, queryClient]);

  // Setup Realtime subscription for runner heartbeat
  useEffect(() => {
    if (isPaused) return;

    const channel = supabase
      .channel(`runner-heartbeat-${runner.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'runners',
          filter: `id=eq.${runner.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['runner-live', runner.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [runner.id, isPaused, queryClient]);

  // Generate logs from orders, heartbeats, and API logs
  useEffect(() => {
    if (isPaused) return;

    const newLogs: LogEntry[] = [];

    // Add heartbeat log if last_seen_at changed
    const lastSeen = runnerData?.last_seen_at;
    if (lastSeen && lastSeen !== lastHeartbeatRef.current) {
      lastHeartbeatRef.current = lastSeen;
      newLogs.push({
        id: `heartbeat-${lastSeen}`,
        timestamp: new Date(lastSeen),
        type: 'heartbeat',
        message: 'Heartbeat reçu du runner',
      });
    }

    // Add order-related logs
    if (orders) {
      orders.forEach(order => {
        const orderTyped = order as {
          id: string;
          name: string;
          status: string;
          created_at: string;
          started_at: string | null;
          completed_at: string | null;
          error_message: string | null;
          result: unknown;
          updated_at: string;
        };

        // Order pending (created but not started)
        if (orderTyped.status === 'pending') {
          newLogs.push({
            id: `order-pending-${orderTyped.id}`,
            timestamp: new Date(orderTyped.created_at),
            type: 'order_pending',
            message: `📋 Ordre en attente: ${orderTyped.name}`,
            details: { order_id: orderTyped.id, status: 'pending' },
          });
        }

        // Order running (started)
        if (orderTyped.status === 'running' && orderTyped.started_at) {
          newLogs.push({
            id: `order-running-${orderTyped.id}`,
            timestamp: new Date(orderTyped.started_at),
            type: 'order_execute',
            message: `⚡ Exécution en cours: ${orderTyped.name}`,
            details: { order_id: orderTyped.id, status: 'running' },
          });
        }

        // Order completed
        if (orderTyped.status === 'completed' && orderTyped.completed_at) {
          newLogs.push({
            id: `order-completed-${orderTyped.id}`,
            timestamp: new Date(orderTyped.completed_at),
            type: 'order_complete',
            message: `✅ Terminé: ${orderTyped.name}`,
            details: { order_id: orderTyped.id, result: orderTyped.result },
          });
        }

        // Order failed
        if (orderTyped.status === 'failed' && orderTyped.completed_at) {
          newLogs.push({
            id: `order-failed-${orderTyped.id}`,
            timestamp: new Date(orderTyped.completed_at),
            type: 'order_fail',
            message: `❌ Échec: ${orderTyped.name} - ${orderTyped.error_message || 'Erreur inconnue'}`,
            details: { order_id: orderTyped.id, error: orderTyped.error_message },
          });
        }
      });
    }

    // Add API logs (reports received, parse errors)
    if (apiLogs) {
      apiLogs.forEach((log: {
        id: string;
        timestamp: string;
        level: string;
        event_type: string;
        message: string;
        raw_body: string | null;
        parsed_data: unknown;
        error_details: string | null;
      }) => {
        const isError = log.level === 'error';
        newLogs.push({
          id: `api-${log.id}`,
          timestamp: new Date(log.timestamp),
          type: isError ? 'api_error' : 'api_report',
          message: isError 
            ? `🔴 ${log.message}${log.error_details ? ` - ${log.error_details}` : ''}`
            : `📨 ${log.message}`,
          details: log.parsed_data as Record<string, unknown> | undefined,
          rawBody: log.raw_body || undefined,
        });
      });
    }

    // Sort by timestamp descending and deduplicate
    const allLogs = [...logs, ...newLogs];
    const uniqueLogs = allLogs
      .filter((log, index, self) => index === self.findIndex(l => l.id === log.id))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 100);

    // Only update if there are changes
    if (JSON.stringify(uniqueLogs.map(l => l.id)) !== JSON.stringify(logs.map(l => l.id))) {
      setLogs(uniqueLogs);
    }
  }, [orders, runnerData?.last_seen_at, apiLogs, isPaused]);

  // Auto-scroll to top when new logs arrive
  useEffect(() => {
    if (!isPaused && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [logs.length, isPaused]);

  const clearLogs = () => {
    setLogs([]);
    processedOrdersRef.current.clear();
    lastHeartbeatRef.current = null;
  };

  const downloadLogs = () => {
    const logText = logs.map(log => 
      `[${format(log.timestamp, "yyyy-MM-dd HH:mm:ss")}] [${log.type.toUpperCase()}] ${log.message}`
    ).join('\n');
    
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `runner-${runner.name}-logs-${format(new Date(), "yyyy-MM-dd-HHmmss")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getLogTypeColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'heartbeat': return 'text-blue-400';
      case 'order_pending': return 'text-yellow-400';
      case 'order_execute': return 'text-orange-400';
      case 'order_complete': return 'text-green-400';
      case 'order_fail': return 'text-red-400';
      case 'system': return 'text-purple-400';
      case 'api_report': return 'text-cyan-400';
      case 'api_error': return 'text-red-500';
      default: return 'text-muted-foreground';
    }
  };

  const getLogTypeBadge = (type: LogEntry['type']) => {
    switch (type) {
      case 'heartbeat': return { label: 'HB', variant: 'secondary' as const };
      case 'order_pending': return { label: 'WAIT', variant: 'outline' as const };
      case 'order_execute': return { label: 'EXEC', variant: 'default' as const };
      case 'order_complete': return { label: 'OK', variant: 'default' as const };
      case 'order_fail': return { label: 'ERR', variant: 'destructive' as const };
      case 'system': return { label: 'SYS', variant: 'secondary' as const };
      case 'api_report': return { label: 'API', variant: 'default' as const };
      case 'api_error': return { label: 'API!', variant: 'destructive' as const };
      default: return { label: '???', variant: 'outline' as const };
    }
  };

  const currentStatus = runnerData?.status || runner.status;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Logs en temps réel</span>
          <Badge variant={currentStatus === 'online' ? 'default' : 'secondary'} className="text-xs">
            {currentStatus}
          </Badge>
          {!isPaused && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-muted-foreground">Live</span>
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsPaused(!isPaused)}
            className="h-7 px-2"
          >
            {isPaused ? (
              <>
                <Play className="w-3 h-3 mr-1" />
                Reprendre
              </>
            ) : (
              <>
                <Pause className="w-3 h-3 mr-1" />
                Pause
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={downloadLogs}
            className="h-7 px-2"
            disabled={logs.length === 0}
          >
            <Download className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearLogs}
            className="h-7 px-2"
            disabled={logs.length === 0}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Logs display */}
      <ScrollArea className="h-64 rounded-lg bg-black/50 border border-border/50" ref={scrollRef}>
        <div className="p-3 font-mono text-xs space-y-1">
          {logs.length === 0 ? (
            <div className="text-muted-foreground text-center py-8">
              <Terminal className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>Aucun log pour le moment</p>
              <p className="text-xs mt-1">Les logs apparaîtront ici en temps réel</p>
            </div>
          ) : (
            logs.map(log => (
              <LogLine key={log.id} log={log} getLogTypeBadge={getLogTypeBadge} getLogTypeColor={getLogTypeColor} />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
