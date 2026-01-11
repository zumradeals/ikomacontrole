import { useState, useEffect, useRef } from 'react';
import { Terminal, RefreshCw, Trash2, Download, Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQuery } from '@tanstack/react-query';
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
  type: 'heartbeat' | 'order_poll' | 'order_execute' | 'order_complete' | 'order_fail' | 'system';
  message: string;
  details?: Record<string, unknown>;
}

export function RunnerLogs({ runner }: RunnerLogsProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastSeenRef = useRef<string | null>(null);

  // Fetch recent orders to generate log entries
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
    refetchInterval: isPaused ? false : 3000,
  });

  // Generate logs from orders and heartbeats
  useEffect(() => {
    if (!orders || isPaused) return;

    const newLogs: LogEntry[] = [];

    // Add heartbeat logs based on last_seen_at changes
    if (runner.last_seen_at && runner.last_seen_at !== lastSeenRef.current) {
      lastSeenRef.current = runner.last_seen_at;
      newLogs.push({
        id: `heartbeat-${Date.now()}`,
        timestamp: new Date(runner.last_seen_at),
        type: 'heartbeat',
        message: 'Heartbeat reçu',
      });
    }

    // Add order-related logs
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
      };

      // Order created
      newLogs.push({
        id: `order-created-${orderTyped.id}`,
        timestamp: new Date(orderTyped.created_at),
        type: 'order_poll',
        message: `Ordre reçu: ${orderTyped.name}`,
        details: { order_id: orderTyped.id },
      });

      // Order started
      if (orderTyped.started_at) {
        newLogs.push({
          id: `order-started-${orderTyped.id}`,
          timestamp: new Date(orderTyped.started_at),
          type: 'order_execute',
          message: `Exécution: ${orderTyped.name}`,
          details: { order_id: orderTyped.id },
        });
      }

      // Order completed or failed
      if (orderTyped.completed_at) {
        if (orderTyped.status === 'completed') {
          newLogs.push({
            id: `order-completed-${orderTyped.id}`,
            timestamp: new Date(orderTyped.completed_at),
            type: 'order_complete',
            message: `Terminé: ${orderTyped.name}`,
            details: { order_id: orderTyped.id, result: orderTyped.result },
          });
        } else if (orderTyped.status === 'failed') {
          newLogs.push({
            id: `order-failed-${orderTyped.id}`,
            timestamp: new Date(orderTyped.completed_at),
            type: 'order_fail',
            message: `Échec: ${orderTyped.name} - ${orderTyped.error_message || 'Erreur inconnue'}`,
            details: { order_id: orderTyped.id, error: orderTyped.error_message },
          });
        }
      }
    });

    // Sort by timestamp descending and deduplicate
    const sortedLogs = newLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    const uniqueLogs = sortedLogs.filter((log, index, self) => 
      index === self.findIndex(l => l.id === log.id)
    ).slice(0, 100);

    setLogs(uniqueLogs);
  }, [orders, runner.last_seen_at, isPaused]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (!isPaused && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [logs, isPaused]);

  const clearLogs = () => {
    setLogs([]);
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
      case 'order_poll': return 'text-cyan-400';
      case 'order_execute': return 'text-yellow-400';
      case 'order_complete': return 'text-green-400';
      case 'order_fail': return 'text-red-400';
      case 'system': return 'text-purple-400';
      default: return 'text-muted-foreground';
    }
  };

  const getLogTypeBadge = (type: LogEntry['type']) => {
    switch (type) {
      case 'heartbeat': return { label: 'HB', variant: 'secondary' as const };
      case 'order_poll': return { label: 'POLL', variant: 'outline' as const };
      case 'order_execute': return { label: 'EXEC', variant: 'default' as const };
      case 'order_complete': return { label: 'OK', variant: 'default' as const };
      case 'order_fail': return { label: 'ERR', variant: 'destructive' as const };
      case 'system': return { label: 'SYS', variant: 'secondary' as const };
      default: return { label: '???', variant: 'outline' as const };
    }
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Logs en temps réel</span>
          <Badge variant={runner.status === 'online' ? 'default' : 'secondary'} className="text-xs">
            {runner.status}
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
              <div key={log.id} className="flex items-start gap-2 hover:bg-white/5 rounded px-1 -mx-1">
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
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
