/**
 * Orders Page
 * 
 * Page de gestion des ordres alignée sur le moteur IKOMA:
 * - Création d'ordre (POST /v1/orders)
 * - Recherche par ID (GET /v1/orders/:id)
 * - Liste des ordres si disponible
 */

import { useState, useEffect } from 'react';
import { ClipboardList, RefreshCw, Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { OrderCreateForm } from '@/components/orders/OrderCreateForm';
import { OrderLookup } from '@/components/orders/OrderLookup';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { listOrders, type IkomaOrder } from '@/lib/api/ikomaApi';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const Orders = () => {
  const [orders, setOrders] = useState<IkomaOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [listAvailable, setListAvailable] = useState(true);

  const loadOrders = async () => {
    setLoading(true);
    const result = await listOrders();
    setLoading(false);

    if (!result.success) {
      if (result.error?.type === 'NOT_FOUND') {
        setListAvailable(false);
      } else {
        toast.error(result.error?.message || 'Erreur lors du chargement');
      }
      return;
    }

    setOrders(result.data || []);
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }> = {
      QUEUED: { variant: 'secondary' },
      RUNNING: { variant: 'default' },
      SUCCEEDED: { variant: 'default', className: 'bg-success text-success-foreground' },
      FAILED: { variant: 'destructive' },
      CANCELLED: { variant: 'outline' },
    };
    const cfg = variants[status] || variants.QUEUED;
    return <Badge variant={cfg.variant} className={cfg.className}>{status}</Badge>;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Orders"
        description="Gestion des ordres d'exécution IKOMA"
        icon={ClipboardList}
      />

      <Tabs defaultValue="create" className="space-y-6">
        <TabsList>
          <TabsTrigger value="create" className="gap-2">
            <Plus className="w-4 h-4" />
            Créer
          </TabsTrigger>
          <TabsTrigger value="lookup" className="gap-2">
            Recherche
          </TabsTrigger>
          <TabsTrigger value="list" className="gap-2">
            Liste
          </TabsTrigger>
        </TabsList>

        <TabsContent value="create">
          <OrderCreateForm onOrderCreated={() => loadOrders()} />
        </TabsContent>

        <TabsContent value="lookup">
          <OrderLookup />
        </TabsContent>

        <TabsContent value="list">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Liste des Orders</CardTitle>
                  <CardDescription>
                    {listAvailable 
                      ? 'Tous les ordres récents' 
                      : 'GET /v1/orders non disponible - utilisez la recherche par ID'}
                  </CardDescription>
                </div>
                {listAvailable && (
                  <Button variant="outline" size="sm" onClick={loadOrders} disabled={loading}>
                    <RefreshCw className={cn('w-4 h-4 mr-2', loading && 'animate-spin')} />
                    Actualiser
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!listAvailable ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>L'endpoint GET /v1/orders n'est pas disponible.</p>
                  <p className="text-sm mt-1">Utilisez l'onglet "Recherche" pour trouver un ordre par ID.</p>
                </div>
              ) : orders.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Aucun ordre trouvé
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Playbook</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Créé</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell>
                          <code className="text-xs">{order.id.slice(0, 8)}...</code>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{order.playbookKey}</TableCell>
                        <TableCell>{getStatusBadge(order.status)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(order.createdAt).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Orders;
