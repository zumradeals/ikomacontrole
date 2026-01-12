import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCreateOrder } from '@/hooks/useOrders';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  Play, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Terminal,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TestOrderButtonProps {
  runnerId: string;
  runnerName: string;
  disabled?: boolean;
}

export function TestOrderButton({ runnerId, runnerName, disabled }: TestOrderButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [testOrderId, setTestOrderId] = useState<string | null>(null);
  const createOrder = useCreateOrder();
  const queryClient = useQueryClient();

  // Poll the order status when we have a test order
  const { data: orderStatus } = useQuery({
    queryKey: ['test-order', testOrderId],
    queryFn: async () => {
      if (!testOrderId) return null;
      
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', testOrderId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!testOrderId,
    refetchInterval: (data) => {
      // Stop polling once complete
      if (data?.status === 'completed' || data?.status === 'failed') {
        return false;
      }
      return 1000; // Poll every second
    },
  });

  const handleStartTest = async () => {
    setTestOrderId(null);
    
    const testCommand = `#!/bin/bash
echo "=== Ikoma Runner Test ==="
echo "Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "Hostname: $(hostname)"
echo "Runner ID: ${runnerId}"
echo ""
echo "Testing basic operations..."
sleep 2
echo "✓ Echo test passed"
echo "✓ Sleep test passed"
echo ""
echo "Test completed successfully!"
echo '{"capabilities":{"test.passed":"installed"}}'
`;

    try {
      const result = await createOrder.mutateAsync({
        runner_id: runnerId,
        category: 'maintenance',
        name: 'Test Order (echo)',
        description: '[test.echo] Simple echo test to verify runner functionality',
        command: testCommand,
      });
      
      setTestOrderId(result.id);
    } catch (error) {
      console.error('Failed to create test order:', error);
    }
  };

  const getStatusBadge = () => {
    if (!orderStatus) {
      return <Badge variant="outline">En attente...</Badge>;
    }

    switch (orderStatus.status) {
      case 'pending':
        return <Badge variant="secondary" className="gap-1"><Clock className="w-3 h-3" />En queue</Badge>;
      case 'running':
        return <Badge variant="default" className="gap-1 bg-blue-500"><Loader2 className="w-3 h-3 animate-spin" />En cours</Badge>;
      case 'completed':
        return <Badge variant="default" className="gap-1 bg-green-500"><CheckCircle2 className="w-3 h-3" />Appliqué</Badge>;
      case 'failed':
        return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" />Échec</Badge>;
      default:
        return <Badge variant="outline">{orderStatus.status}</Badge>;
    }
  };

  return (
    <>
      <Button 
        variant="outline" 
        size="sm" 
        onClick={() => setIsOpen(true)}
        disabled={disabled}
      >
        <Play className="w-4 h-4 mr-2" />
        Test Order
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Terminal className="w-5 h-5" />
              Test Runner: {runnerName}
            </DialogTitle>
            <DialogDescription>
              Envoie un ordre de test simple (echo) pour vérifier que le runner fonctionne.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Start Button */}
            {!testOrderId && (
              <Button 
                onClick={handleStartTest}
                disabled={createOrder.isPending}
                className="w-full"
              >
                {createOrder.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Création de l'ordre...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Lancer le test
                  </>
                )}
              </Button>
            )}

            {/* Order Status */}
            {testOrderId && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Order ID: {testOrderId.slice(0, 8)}...</p>
                    <p className="text-xs text-muted-foreground">
                      {orderStatus?.started_at 
                        ? `Démarré: ${new Date(orderStatus.started_at).toLocaleTimeString()}`
                        : 'En attente de démarrage...'
                      }
                    </p>
                  </div>
                  {getStatusBadge()}
                </div>

                {/* Logs */}
                {orderStatus?.stdout_tail && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Sortie (stdout):</p>
                    <ScrollArea className="h-48 rounded-lg border bg-black/90 p-3">
                      <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap">
                        {orderStatus.stdout_tail}
                      </pre>
                    </ScrollArea>
                  </div>
                )}

                {orderStatus?.stderr_tail && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-destructive">Erreurs (stderr):</p>
                    <ScrollArea className="h-24 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                      <pre className="text-xs text-red-400 font-mono whitespace-pre-wrap">
                        {orderStatus.stderr_tail}
                      </pre>
                    </ScrollArea>
                  </div>
                )}

                {/* Exit Code */}
                {orderStatus?.exit_code !== null && orderStatus?.exit_code !== undefined && (
                  <div className={cn(
                    "flex items-center gap-2 p-3 rounded-lg",
                    orderStatus.exit_code === 0 
                      ? "bg-green-500/10 border border-green-500/20"
                      : "bg-destructive/10 border border-destructive/20"
                  )}>
                    {orderStatus.exit_code === 0 ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-destructive" />
                    )}
                    <span className="text-sm">
                      Exit code: <code className="font-mono">{orderStatus.exit_code}</code>
                    </span>
                  </div>
                )}

                {/* Retry Button */}
                {(orderStatus?.status === 'completed' || orderStatus?.status === 'failed') && (
                  <Button 
                    variant="outline"
                    onClick={handleStartTest}
                    className="w-full"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Relancer le test
                  </Button>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
