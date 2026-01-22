/**
 * PLAYBOOK EXECUTION TRACKER
 * 
 * Real-time visualization of running playbook/order executions.
 * Uses Supabase Realtime to show live progress updates.
 * Automatically syncs capabilities after successful execution.
 * 
 * PASSIVE DISPLAY: Shows data from API without interpretation.
 * Uses reportContract when available for structured execution details.
 */

import { useEffect, useMemo, useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ChevronDown,
  ChevronUp,
  Zap,
  RefreshCw
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { Order, OrderStatus, useCancelOrder } from '@/hooks/useOrders';
import { useAutoCapabilitySync } from '@/hooks/useCapabilitySync';
import { OrderReportView } from '@/components/orders/OrderReportView';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface PlaybookExecutionTrackerProps {
  runnerId: string;
  orders: Order[];
  className?: string;
}

const statusConfig: Record<OrderStatus, { 
  icon: React.ReactNode; 
  label: string; 
  color: string;
  bgColor: string;
}> = {
  pending: {
    icon: <Clock className="w-4 h-4" />,
    label: 'En file',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
  },
  running: {
    icon: <Loader2 className="w-4 h-4 animate-spin" />,
    label: 'En cours',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
  },
  completed: {
    icon: <CheckCircle2 className="w-4 h-4" />,
    label: 'Terminé',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
  },
  failed: {
    icon: <XCircle className="w-4 h-4" />,
    label: 'Échec',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
  },
  cancelled: {
    icon: <XCircle className="w-4 h-4" />,
    label: 'Annulé',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/30',
  },
};

function ExecutionItem({ order, isExpanded, onToggle }: { 
  order: Order; 
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const status = statusConfig[order.status];
  const cancelOrder = useCancelOrder();
  
  // Use progress from API only - NO frontend estimation
  // The backend is the source of truth for progress
  const progress = useMemo(() => {
    if (order.status === 'completed') return 100;
    if (order.status === 'failed' || order.status === 'cancelled') return 100;
    if (order.progress !== null && order.progress !== undefined) return order.progress;
    if (order.status === 'pending') return 0;
    // Running without explicit progress: show indeterminate state
    return null;
  }, [order]);

  // Extract playbook ID from description
  const playbookId = useMemo(() => {
    const match = order.description?.match(/^\[([a-z0-9_.]+)\]/);
    return match ? match[1] : null;
  }, [order.description]);

  return (
    <div className={cn(
      "rounded-lg border transition-all duration-200",
      order.status === 'running' && "border-blue-500/50 bg-blue-500/5",
      order.status === 'pending' && "border-amber-500/30 bg-amber-500/5",
      order.status === 'completed' && "border-emerald-500/30",
      order.status === 'failed' && "border-red-500/30",
      order.status === 'cancelled' && "border-border/50"
    )}>
      {/* Header */}
      <button 
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3"
      >
        <div className={cn("p-1.5 rounded-md", status.bgColor, status.color)}>
          {status.icon}
        </div>
        
        <div className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{order.name}</span>
            {playbookId && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                {playbookId}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={cn("text-xs", status.color)}>{status.label}</span>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(order.created_at), { addSuffix: true, locale: fr })}
            </span>
          </div>
        </div>

        {/* Progress indicator for running - only show if backend provides it */}
        {order.status === 'running' && progress !== null && (
          <div className="w-16 text-right">
            <span className="text-xs font-mono text-blue-400">{progress}%</span>
          </div>
        )}

        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {/* Progress bar for running orders - only if backend provides progress */}
      {order.status === 'running' && progress !== null && (
        <div className="px-3 pb-2">
          <Progress value={progress} className="h-1.5" />
        </div>
      )}

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-1 border-t border-border/50 space-y-2">
          {/* Report Contract - primary display when available */}
          {order.report_contract && (
            <OrderReportView reportContract={order.report_contract} />
          )}

          {/* Fallback: Stdout tail - only show if no reportContract */}
          {!order.report_contract && order.stdout_tail && (
            <div>
              <p className="text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wider">
                Sortie
              </p>
              <ScrollArea className="h-24">
                <pre className="text-xs font-mono bg-background/50 p-2 rounded whitespace-pre-wrap">
                  {order.stdout_tail.split('\n').slice(-10).join('\n')}
                </pre>
              </ScrollArea>
            </div>
          )}

          {/* Error for failed orders - only show if no reportContract */}
          {!order.report_contract && order.status === 'failed' && order.stderr_tail && (
            <div>
              <p className="text-[10px] font-medium text-red-400 mb-1 uppercase tracking-wider">
                Erreur
              </p>
              <pre className="text-xs font-mono bg-red-500/10 text-red-300 p-2 rounded whitespace-pre-wrap max-h-20 overflow-y-auto">
                {order.stderr_tail.split('\n').slice(-5).join('\n')}
              </pre>
            </div>
          )}

          {/* Exit code */}
          {order.exit_code !== null && order.exit_code !== undefined && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Exit code:</span>
              <span className={cn(
                "font-mono",
                order.exit_code === 0 ? "text-emerald-400" : "text-red-400"
              )}>
                {order.exit_code}
              </span>
            </div>
          )}

          {/* Cancel button for pending orders */}
          {order.status === 'pending' && (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                cancelOrder.mutate({ orderId: order.id, runnerId: order.runner_id });
              }}
              disabled={cancelOrder.isPending}
              className="text-xs h-7"
            >
              Annuler
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function PlaybookExecutionTracker({ 
  runnerId, 
  orders,
  className 
}: PlaybookExecutionTrackerProps) {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { processCompletedOrder, isSyncing } = useAutoCapabilitySync();
  
  // Track which orders we've already processed for capability sync
  const processedOrdersRef = useRef<Set<string>>(new Set());

  // Filter to active orders (pending/running) and recent completed/failed
  const activeOrders = useMemo(() => {
    const now = Date.now();
    const recentThreshold = 5 * 60 * 1000; // 5 minutes
    
    return orders.filter(o => {
      if (o.status === 'pending' || o.status === 'running') return true;
      // Show completed/failed for 5 minutes
      if (o.completed_at) {
        return now - new Date(o.completed_at).getTime() < recentThreshold;
      }
      return false;
    }).slice(0, 5); // Limit to 5 items
  }, [orders]);

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel(`playbook-tracker-${runnerId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `runner_id=eq.${runnerId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['orders', runnerId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [runnerId, queryClient]);

  // Auto-expand running orders
  useEffect(() => {
    const runningOrder = activeOrders.find(o => o.status === 'running');
    if (runningOrder && !expandedId) {
      setExpandedId(runningOrder.id);
    }
  }, [activeOrders, expandedId]);

  // Auto-sync capabilities when orders complete
  useEffect(() => {
    for (const order of orders) {
      if (
        order.status === 'completed' && 
        !processedOrdersRef.current.has(order.id) &&
        order.stdout_tail
      ) {
        processedOrdersRef.current.add(order.id);
        processCompletedOrder(
          runnerId,
          order.id,
          order.status,
          order.stdout_tail,
          order.result
        );
      }
    }
  }, [orders, runnerId, processCompletedOrder]);

  if (activeOrders.length === 0) {
    return null; // Don't show anything if no active orders
  }

  const runningCount = activeOrders.filter(o => o.status === 'running').length;
  const pendingCount = activeOrders.filter(o => o.status === 'pending').length;

  return (
    <div className={cn("glass-panel rounded-xl p-4 space-y-3", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Exécution en cours</h3>
          {isSyncing && (
            <RefreshCw className="w-3 h-3 text-primary animate-spin" />
          )}
        </div>
        <div className="flex items-center gap-2">
          {isSyncing && (
            <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
              <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
              Sync capacités
            </Badge>
          )}
          {runningCount > 0 && (
            <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-400 border-blue-500/30">
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              {runningCount} en cours
            </Badge>
          )}
          {pendingCount > 0 && (
            <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-400 border-amber-500/30">
              <Clock className="w-3 h-3 mr-1" />
              {pendingCount} en file
            </Badge>
          )}
        </div>
      </div>

      {/* Active orders list */}
      <div className="space-y-2">
        {activeOrders.map(order => (
          <ExecutionItem
            key={order.id}
            order={order}
            isExpanded={expandedId === order.id}
            onToggle={() => setExpandedId(prev => prev === order.id ? null : order.id)}
          />
        ))}
      </div>
    </div>
  );
}
