import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Ban,
  Download,
  RefreshCw,
  Shield,
  Wrench,
  Scan,
  ChevronRight,
  Terminal
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useState } from 'react';
import { Order, OrderCategory, OrderStatus, useCancelOrder } from '@/hooks/useOrders';

interface OrdersHistoryProps {
  runnerId: string;
  infrastructureId?: string;
}

const categoryIcons: Record<OrderCategory, React.ReactNode> = {
  installation: <Download className="w-4 h-4" />,
  update: <RefreshCw className="w-4 h-4" />,
  security: <Shield className="w-4 h-4" />,
  maintenance: <Wrench className="w-4 h-4" />,
  detection: <Scan className="w-4 h-4" />,
};

const categoryLabels: Record<OrderCategory, string> = {
  installation: 'Installation',
  update: 'Mise à jour',
  security: 'Sécurité',
  maintenance: 'Maintenance',
  detection: 'Détection',
};

const statusConfig: Record<OrderStatus, { icon: React.ReactNode; label: string; class: string }> = {
  pending: {
    icon: <Clock className="w-4 h-4" />,
    label: 'En attente',
    class: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  },
  running: {
    icon: <Loader2 className="w-4 h-4 animate-spin" />,
    label: 'En cours',
    class: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  },
  completed: {
    icon: <CheckCircle2 className="w-4 h-4" />,
    label: 'Terminé',
    class: 'bg-green-500/10 text-green-400 border-green-500/30',
  },
  failed: {
    icon: <XCircle className="w-4 h-4" />,
    label: 'Échec',
    class: 'bg-red-500/10 text-red-400 border-red-500/30',
  },
  cancelled: {
    icon: <Ban className="w-4 h-4" />,
    label: 'Annulé',
    class: 'bg-muted text-muted-foreground border-border',
  },
};

function OrderItem({ order }: { order: Order }) {
  const [isOpen, setIsOpen] = useState(false);
  const cancelOrder = useCancelOrder();
  const status = statusConfig[order.status];
  const categoryIcon = categoryIcons[order.category];

  const handleCancel = () => {
    cancelOrder.mutate({ orderId: order.id, runnerId: order.runner_id });
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className={`rounded-lg border transition-colors ${
        isOpen ? 'border-primary/30 bg-muted/30' : 'border-border/50 hover:border-border'
      }`}>
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center gap-3 p-3">
            <div className="text-muted-foreground">{categoryIcon}</div>
            <div className="flex-1 text-left">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{order.name}</span>
                <Badge variant="outline" className={`text-xs ${status.class}`}>
                  {status.icon}
                  <span className="ml-1">{status.label}</span>
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatDistanceToNow(new Date(order.created_at), { addSuffix: true, locale: fr })}
              </p>
            </div>
            <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-90' : ''}`} />
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-3 pb-3 pt-1 space-y-3 border-t border-border/50">
            {/* Description */}
            {order.description && (
              <p className="text-sm text-muted-foreground">{order.description}</p>
            )}

            {/* Command */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Commande</p>
              <pre className="text-xs bg-background/50 p-2 rounded overflow-x-auto font-mono">
                {order.command.length > 100 ? order.command.substring(0, 100) + '...' : order.command}
              </pre>
            </div>

            {/* Timeline */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Créé : </span>
                <span>{format(new Date(order.created_at), "dd/MM/yyyy HH:mm", { locale: fr })}</span>
              </div>
              {order.started_at && (
                <div>
                  <span className="text-muted-foreground">Démarré : </span>
                  <span>{format(new Date(order.started_at), "HH:mm:ss", { locale: fr })}</span>
                </div>
              )}
              {order.completed_at && (
                <div>
                  <span className="text-muted-foreground">Terminé : </span>
                  <span>{format(new Date(order.completed_at), "HH:mm:ss", { locale: fr })}</span>
                </div>
              )}
            </div>

            {/* Error message */}
            {order.error_message && (
              <div className="p-2 rounded bg-red-500/10 border border-red-500/30">
                <p className="text-xs text-red-400">{order.error_message}</p>
              </div>
            )}

            {/* Result */}
            {order.result && Object.keys(order.result as object).length > 0 && order.status === 'completed' && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Résultat</p>
                <pre className="text-xs bg-background/50 p-2 rounded overflow-x-auto font-mono max-h-32">
                  {JSON.stringify(order.result, null, 2)}
                </pre>
              </div>
            )}

            {/* Actions */}
            {order.status === 'pending' && (
              <div className="flex justify-end">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleCancel}
                  disabled={cancelOrder.isPending}
                  className="text-destructive hover:text-destructive"
                >
                  <Ban className="w-3 h-3 mr-1" />
                  Annuler
                </Button>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export function OrdersHistory({ runnerId, infrastructureId }: OrdersHistoryProps) {
  const queryClient = useQueryClient();

  const { data: orders, isLoading } = useQuery({
    queryKey: ['orders', runnerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('runner_id', runnerId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as Order[];
    },
  });

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel(`orders-${runnerId}`)
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Terminal className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">Aucun ordre exécuté</p>
        <p className="text-xs mt-1">Les ordres système apparaîtront ici.</p>
      </div>
    );
  }

  // Group by status
  const pending = orders.filter(o => o.status === 'pending');
  const running = orders.filter(o => o.status === 'running');
  const completed = orders.filter(o => o.status === 'completed' || o.status === 'failed' || o.status === 'cancelled');

  return (
    <div className="space-y-4">
      {/* Active orders */}
      {(pending.length > 0 || running.length > 0) && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Ordres actifs ({pending.length + running.length})
          </h4>
          <div className="space-y-2">
            {running.map(order => (
              <OrderItem key={order.id} order={order} />
            ))}
            {pending.map(order => (
              <OrderItem key={order.id} order={order} />
            ))}
          </div>
        </div>
      )}

      {/* Completed orders */}
      {completed.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Historique ({completed.length})
          </h4>
          <ScrollArea className="max-h-80">
            <div className="space-y-2 pr-2">
              {completed.map(order => (
                <OrderItem key={order.id} order={order} />
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}