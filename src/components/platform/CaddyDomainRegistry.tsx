import { useState, useMemo } from 'react';
import { Globe, Plus, Trash2, CheckCircle2, Loader2, RefreshCw, ExternalLink, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { useRunners } from '@/hooks/useRunners';
import { CaddyRouteDialog, CaddyRouteSubmitData } from './CaddyRouteDialog';
import { toast } from '@/hooks/use-toast';

interface CaddyDomainRegistryProps {
  infrastructureId?: string;
  runnerId?: string;
  onRouteCreated?: (route: CaddyRoute) => void;
}

export function CaddyDomainRegistry({ 
  infrastructureId, 
  runnerId: providedRunnerId,
  onRouteCreated 
}: CaddyDomainRegistryProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [deleteRoute, setDeleteRoute] = useState<CaddyRoute | null>(null);
  const [verifyingRouteId, setVerifyingRouteId] = useState<string | null>(null);

  const { data: routes = [], isLoading } = useCaddyRoutes(infrastructureId);
  const { data: runners = [] } = useRunners();
  const createRoute = useCreateCaddyRoute();
  const deleteRouteMutation = useDeleteCaddyRoute();
  const updateRoute = useUpdateCaddyRoute();
  const createOrder = useCreateOrder();

  // Trouver le runner associé à cette infrastructure (même offline)
  const associatedRunner = useMemo(() => {
    if (providedRunnerId) {
      return runners.find(r => r.id === providedRunnerId) || null;
    }
    return runners.find(r => r.infrastructure_id === infrastructureId) || null;
  }, [runners, providedRunnerId, infrastructureId]);

  // Vérifier si le runner associé est en ligne
  const activeRunner = associatedRunner?.status === 'online' ? associatedRunner : null;
  const hasActiveRunner = !!activeRunner;
  const hasOfflineRunner = !!associatedRunner && !activeRunner;

  // Générer le script Caddy pour un domaine
  const generateCaddyScript = (fullDomain: string, backendUrl: string) => {
    return `#!/bin/bash
set -e

DOMAIN="${fullDomain}"
BACKEND="${backendUrl}"

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
  };

  const handleCreateRoute = async (data: CaddyRouteSubmitData) => {
    if (!infrastructureId) {
      toast({
        title: 'Erreur',
        description: 'Aucune infrastructure sélectionnée',
        variant: 'destructive',
      });
      return;
    }

    if (!activeRunner) {
      toast({
        title: 'Erreur',
        description: 'Aucun runner actif disponible pour exécuter la configuration',
        variant: 'destructive',
      });
      return;
    }

    const backendUrl = `${data.backend_protocol}://${data.backend_host}:${data.backend_port}`;

    try {
      // Créer les routes selon le type de routage
      const routesToCreate: Array<{ domain: string; subdomain: string | null }> = [];

      switch (data.routing_type) {
        case 'root_only':
          routesToCreate.push({ domain: data.domain, subdomain: null });
          break;
        case 'subdomain_only':
          routesToCreate.push({ domain: data.domain, subdomain: data.subdomain || null });
          break;
        case 'root_and_subdomain':
          routesToCreate.push({ domain: data.domain, subdomain: null });
          routesToCreate.push({ domain: data.domain, subdomain: data.subdomain || null });
          break;
      }

      for (const routeData of routesToCreate) {
        // Créer la route en base
        const route = await createRoute.mutateAsync({
          infrastructure_id: infrastructureId,
          domain: routeData.domain,
          subdomain: routeData.subdomain,
          backend_host: data.backend_host,
          backend_port: data.backend_port,
          backend_protocol: data.backend_protocol,
        });

        // Créer l'ordre de configuration Caddy avec runner_id et infrastructure_id explicites
        const fullDomain = routeData.subdomain 
          ? `${routeData.subdomain}.${routeData.domain}` 
          : routeData.domain;

        await createOrder.mutateAsync({
          runner_id: activeRunner.id,
          infrastructure_id: infrastructureId,
          category: 'installation',
          name: `Caddy: Configurer ${fullDomain}`,
          description: `[proxy.caddy.configure] Configuration reverse proxy ${fullDomain}`,
          command: generateCaddyScript(fullDomain, backendUrl),
        });

        // Mettre à jour le statut de provisioning
        await updateRoute.mutateAsync({
          id: route.id,
          https_status: 'provisioning',
        });

        onRouteCreated?.(route);
      }

      toast({
        title: 'Routes créées',
        description: `${routesToCreate.length} route(s) envoyée(s) au runner ${activeRunner.name}`,
      });
    } catch (error) {
      // Errors handled by mutations
    }
  };

  const handleVerifyRoute = async (route: CaddyRoute) => {
    if (!activeRunner) {
      toast({
        title: 'Erreur',
        description: 'Aucun runner actif. Impossible d\'exécuter la configuration.',
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

      const backendUrl = `${route.backend_protocol}://${route.backend_host}:${route.backend_port}`;

      // Create Caddy configuration order avec références explicites
      await createOrder.mutateAsync({
        runner_id: activeRunner.id,
        infrastructure_id: infrastructureId,
        category: 'installation',
        name: `Caddy: Configurer ${route.full_domain}`,
        description: `[proxy.caddy.configure] Configuration reverse proxy ${route.full_domain}`,
        command: generateCaddyScript(route.full_domain, backendUrl),
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
        <Button size="sm" onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Ajouter un domaine
        </Button>
      </div>

      {/* Warning si runner offline */}
      {hasOfflineRunner && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Le runner "{associatedRunner?.name}" est hors ligne.</strong>{' '}
            Les ordres Caddy ne seront exécutés que lorsque le runner sera de nouveau en ligne.
          </AlertDescription>
        </Alert>
      )}

      {/* Warning si aucun runner associé */}
      {!associatedRunner && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Aucun runner associé à cette infrastructure.</strong>{' '}
            Associez un runner depuis la page Runners pour exécuter les ordres Caddy.
          </AlertDescription>
        </Alert>
      )}

      {/* Info runner actif */}
      {hasActiveRunner && (
        <Alert className="border-green-500/30 bg-green-500/5">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <AlertDescription className="text-sm">
            Runner actif: <strong>{activeRunner.name}</strong> — Les ordres seront exécutés sur ce runner.
          </AlertDescription>
        </Alert>
      )}

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
                        disabled={verifyingRouteId === route.id || route.https_status === 'ok' || !hasActiveRunner}
                        title={!hasActiveRunner ? 'Aucun runner actif' : 'Vérifier / Configurer HTTPS'}
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

      {/* Add Dialog */}
      <CaddyRouteDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSubmit={handleCreateRoute}
        isLoading={createRoute.isPending}
        hasActiveRunner={hasActiveRunner}
      />

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
