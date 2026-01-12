import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription 
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Order } from '@/hooks/useOrders';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Loader2, 
  AlertCircle 
} from 'lucide-react';

interface ServiceLogsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceName: string;
  orders: Order[];
}

const statusConfig = {
  pending: { icon: Clock, label: 'En attente', color: 'bg-muted text-muted-foreground' },
  running: { icon: Loader2, label: 'En cours', color: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
  completed: { icon: CheckCircle2, label: 'Terminé', color: 'bg-green-500/10 text-green-400 border-green-500/30' },
  failed: { icon: XCircle, label: 'Échoué', color: 'bg-red-500/10 text-red-400 border-red-500/30' },
  cancelled: { icon: AlertCircle, label: 'Annulé', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
};

export function ServiceLogsDialog({ 
  open, 
  onOpenChange, 
  serviceName, 
  orders 
}: ServiceLogsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Historique des ordres - {serviceName}</DialogTitle>
          <DialogDescription>
            Les {orders.length} derniers ordres exécutés pour ce service
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          {orders.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              Aucun ordre pour ce service
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => {
                const config = statusConfig[order.status];
                const StatusIcon = config.icon;
                const isRunning = order.status === 'running';

                return (
                  <div 
                    key={order.id} 
                    className="p-4 rounded-lg border border-border bg-muted/30"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-medium">{order.name}</h4>
                          <Badge variant="outline" className={config.color}>
                            <StatusIcon 
                              className={`w-3 h-3 mr-1 ${isRunning ? 'animate-spin' : ''}`} 
                            />
                            {config.label}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(order.created_at), 'dd MMM yyyy HH:mm', { locale: fr })}
                          {order.completed_at && (
                            <span className="ml-2">
                              → {format(new Date(order.completed_at), 'HH:mm', { locale: fr })}
                            </span>
                          )}
                        </p>
                      </div>
                      
                      {order.exit_code !== null && (
                        <Badge 
                          variant="outline" 
                          className={order.exit_code === 0 
                            ? 'bg-green-500/10 text-green-400' 
                            : 'bg-red-500/10 text-red-400'
                          }
                        >
                          exit: {order.exit_code}
                        </Badge>
                      )}
                    </div>

                    {/* Error message */}
                    {order.error_message && (
                      <div className="mt-3 p-2 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-mono">
                        {order.error_message}
                      </div>
                    )}

                    {/* Stdout */}
                    {order.stdout_tail && (
                      <details className="mt-3">
                        <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                          Sortie standard
                        </summary>
                        <pre className="mt-2 p-2 rounded bg-muted text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                          {order.stdout_tail}
                        </pre>
                      </details>
                    )}

                    {/* Stderr */}
                    {order.stderr_tail && (
                      <details className="mt-2">
                        <summary className="text-xs text-red-400 cursor-pointer hover:text-red-300">
                          Sortie erreur
                        </summary>
                        <pre className="mt-2 p-2 rounded bg-red-500/10 text-xs font-mono overflow-x-auto whitespace-pre-wrap text-red-300">
                          {order.stderr_tail}
                        </pre>
                      </details>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
