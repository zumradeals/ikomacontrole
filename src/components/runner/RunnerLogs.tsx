import { useState, useEffect, useRef } from 'react';
import { Terminal, Trash2, Download, Pause, Play } from 'lucide-react';
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
  type: 'heartbeat' | 'order_pending' | 'order_execute' | 'order_complete' | 'order_fail' | 'system';
  message: string;
  details?: Record<string, unknown>;
}

export function RunnerLogs({ runner }: RunnerLogsProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const processedOrdersRef = useRef<Set<string>>(new Set());
  const lastHeartbeatRef = useRef<string | null>(null);
  const queryClient = useQueryClient();

  // Fetch runner data with realtime updates
  const { data: runnerData } = useQuery({
    queryKey: ['runner-live', runner.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('runners')
        .select('*')
        .eq('id', runner.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    refetchInterval: isPaused ? false : 2000,
  });

  // Fetch recent orders with refetch
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

  // Setup Realtime subscription for orders
  useEffect(() => {
    if (isPaused) return;

    const channel = supabase
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
          // Refetch orders when any change occurs
          queryClient.invalidateQueries({ queryKey: ['runner-logs-orders', runner.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
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

  // Generate logs from orders and heartbeats
  useEffect(() => {
    if (isPaused) return;

    const newLogs: LogEntry[] = [];
    const currentTime = new Date();

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

        // Track which order states we've already logged
        const createdKey = `created-${orderTyped.id}`;
        const startedKey = `started-${orderTyped.id}`;
        const completedKey = `completed-${orderTyped.id}`;

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
  }, [orders, runnerData?.last_seen_at, isPaused]);

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
