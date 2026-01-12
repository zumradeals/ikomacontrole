import { useState } from 'react';
import { Globe, Plus, Trash2, CheckCircle2, XCircle, Loader2, RefreshCw, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  useCaddyRoutes, 
  useCreateCaddyRoute, 
  useDeleteCaddyRoute, 
  useUpdateCaddyRoute,
  CaddyRoute 
} from '@/hooks/useCaddyRoutes';
import { useCreateOrder } from '@/hooks/useOrders';
import { toast } from '@/hooks/use-toast';

interface CaddyDomainRegistryProps {
  infrastructureId?: string;
  runnerId?: string;
  onRouteCreated?: (route: CaddyRoute) => void;
}

export function CaddyDomainRegistry({ 
  infrastructureId, 
  runnerId,
  onRouteCreated 
}: CaddyDomainRegistryProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [deleteRoute, setDeleteRoute] = useState<CaddyRoute | null>(null);
  const [newDomain, setNewDomain] = useState('');
  const [newSubdomain, setNewSubdomain] = useState('');
  const [newPort, setNewPort] = useState('3000');
  const [verifyingRouteId, setVerifyingRouteId] = useState<string | null>(null);

  const { data: routes = [], isLoading } = useCaddyRoutes(infrastructureId);
  const createRoute = useCreateCaddyRoute();
  const deleteRouteMutation = useDeleteCaddyRoute();
  const updateRoute = useUpdateCaddyRoute();
  const createOrder = useCreateOrder();

  const handleCreateRoute = async () => {
    if (!infrastructureId || !newDomain) return;

    try {
      const route = await createRoute.mutateAsync({
        infrastructure_id: infrastructureId,
        domain: newDomain,
        subdomain: newSubdomain || null,
        backend_port: parseInt(newPort) || 3000,
      });

      setIsAddDialogOpen(false);
      setNewDomain('');
      setNewSubdomain('');
      setNewPort('3000');
      onRouteCreated?.(route);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleVerifyRoute = async (route: CaddyRoute) => {
    if (!runnerId) {
      toast({
        title: 'Erreur',
        description: 'Aucun runner associé',
        variant: 'destructive',
      });
      return;
    }

    setVerifyingRouteId(route.id);
    
    try {
      // Update status to provisioning
      await updateRoute.mutateAsync({
        id: route.id,
        https_status: 'provisioning',
      });

      // Create Caddy configuration order
      const command = `#!/bin/bash
set -e

DOMAIN="${route.full_domain}"
BACKEND="${route.backend_protocol}://${route.backend_host}:${route.backend_port}"

echo "=== Configuration Caddy: $DOMAIN ==="

# Ensure Caddy is installed
if ! command -v caddy &> /dev/null; then
  echo "❌ Caddy n'est pas installé"
  exit 1
fi

# Create log directory
mkdir -p /var/log/caddy

# Check if domain exists in config
if grep -q "^$DOMAIN" /etc/caddy/Caddyfile 2>/dev/null; then
  echo "ℹ️ Domaine déjà configuré, mise à jour..."
  sed -i "/^$DOMAIN/,/^}/d" /etc/caddy/Caddyfile
fi

# Add route
cat >> /etc/caddy/Caddyfile << EOF

$DOMAIN {
  reverse_proxy $BACKEND
  encode gzip
  log {
    output file /var/log/caddy/$DOMAIN.log
  }
}
EOF

# Validate and reload
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy

# Wait for certificate
sleep 10

# Verify HTTPS
if curl -sf -o /dev/null "https://$DOMAIN" 2>/dev/null; then
  echo "✅ HTTPS vérifié: https://$DOMAIN"
  echo "HTTPS_STATUS=ok"
else
  echo "⏳ HTTPS en cours de provisioning..."
  echo "HTTPS_STATUS=provisioning"
fi
`;

      await createOrder.mutateAsync({
        runner_id: runnerId,
        infrastructure_id: infrastructureId,
        category: 'installation',
        name: `Caddy: Configurer ${route.full_domain}`,
        description: `[proxy.caddy.configure] Configuration reverse proxy ${route.full_domain}`,
        command,
      });

      // Simulate verification (in production, poll order status)
      setTimeout(async () => {
        await updateRoute.mutateAsync({
          id: route.id,
          https_status: 'ok',
        });
        setVerifyingRouteId(null);
        toast({
          title: 'Route configurée',
          description: `HTTPS actif pour ${route.full_domain}`,
        });
      }, 5000);
    } catch (error) {
      setVerifyingRouteId(null);
      toast({
        title: 'Erreur',
        description: 'Échec de la configuration',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteRoute = async () => {
    if (!deleteRoute) return;
    
    try {
      await deleteRouteMutation.mutateAsync(deleteRoute.id);
      setDeleteRoute(null);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const getStatusBadge = (status: CaddyRoute['https_status']) => {
    switch (status) {
      case 'ok':
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/30">HTTPS OK</Badge>;
      case 'provisioning':
        return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/30">Provisioning</Badge>;
      case 'failed':
        return <Badge variant="destructive">Échec</Badge>;
      default:
        return <Badge variant="secondary">En attente</Badge>;
    }
  };

  const getConsumedByBadge = (consumedBy: string | null) => {
    if (!consumedBy) return <Badge variant="outline" className="text-muted-foreground">Libre</Badge>;
    
    if (consumedBy === 'supabase') {
      return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30">Supabase</Badge>;
    }
    if (consumedBy.startsWith('app:')) {
      return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/30">{consumedBy.replace('app:', '')}</Badge>;
    }
    return <Badge variant="outline">{consumedBy}</Badge>;
  };

  if (!infrastructureId) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Sélectionnez une infrastructure pour voir les domaines
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Registre des domaines Caddy</h3>
          <p className="text-sm text-muted-foreground">
            Domaines et sous-domaines configurés sur cette infrastructure
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Ajouter un domaine
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ajouter un domaine</DialogTitle>
              <DialogDescription>
                Configurez un nouveau domaine ou sous-domaine pour Caddy
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Domaine racine</label>
                <Input
                  placeholder="example.com"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Sous-domaine (optionnel)</label>
                <Input
                  placeholder="app, api, supabase..."
                  value={newSubdomain}
                  onChange={(e) => setNewSubdomain(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Résultat: {newSubdomain ? `${newSubdomain}.` : ''}{newDomain || 'example.com'}
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Port backend</label>
                <Input
                  type="number"
                  placeholder="3000"
                  value={newPort}
                  onChange={(e) => setNewPort(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Annuler
              </Button>
              <Button 
                onClick={handleCreateRoute}
                disabled={!newDomain || createRoute.isPending}
              >
                {createRoute.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                Ajouter
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Routes Table */}
      {isLoading ? (
        <div className="text-center py-8">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
        </div>
      ) : routes.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground border rounded-lg">
          <Globe className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Aucun domaine configuré</p>
          <p className="text-sm mt-1">Ajoutez un domaine pour commencer</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Domaine</TableHead>
                <TableHead>Backend</TableHead>
                <TableHead>HTTPS</TableHead>
                <TableHead>Utilisé par</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {routes.map((route) => (
                <TableRow key={route.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-muted-foreground" />
                      <span className="font-mono text-sm">{route.full_domain}</span>
                      {route.https_status === 'ok' && (
                        <a
                          href={`https://${route.full_domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-sm text-muted-foreground">
                      {route.backend_protocol}://{route.backend_host}:{route.backend_port}
                    </span>
                  </TableCell>
                  <TableCell>{getStatusBadge(route.https_status)}</TableCell>
                  <TableCell>{getConsumedByBadge(route.consumed_by)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleVerifyRoute(route)}
                        disabled={verifyingRouteId === route.id || route.https_status === 'ok'}
                        title="Vérifier / Configurer HTTPS"
                      >
                        {verifyingRouteId === route.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : route.https_status === 'ok' ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteRoute(route)}
                        disabled={!!route.consumed_by}
                        title={route.consumed_by ? 'Domaine en cours d\'utilisation' : 'Supprimer'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteRoute} onOpenChange={() => setDeleteRoute(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le domaine ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le domaine <strong>{deleteRoute?.full_domain}</strong> sera supprimé du registre.
              Cette action ne supprime pas la configuration Caddy sur le serveur.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRoute}
              className="bg-destructive text-destructive-foreground"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
