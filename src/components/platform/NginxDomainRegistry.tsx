import React, { useState, useMemo } from "react";
import { Plus, Globe, Trash2, CheckCircle, Clock, AlertCircle, Loader2, Shield, RefreshCw, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  useNginxRoutes,
  useCreateNginxRoute,
  useDeleteNginxRoute,
  useUpdateNginxRoute,
  NginxRoute,
} from "@/hooks/useNginxRoutes";
import { useRunners } from "@/hooks/useRunners";
import { useCreateOrder } from "@/hooks/useOrders";
import { NginxRouteDialog, NginxRouteSubmitData } from "./NginxRouteDialog";
import { getNginxPlaybookById } from "@/lib/nginx-playbooks";

interface NginxDomainRegistryProps {
  infrastructureId?: string;
  runnerId?: string;
  onRouteCreated?: (route: NginxRoute) => void;
}

export function NginxDomainRegistry({
  infrastructureId,
  runnerId,
  onRouteCreated,
}: NginxDomainRegistryProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [deleteRoute, setDeleteRoute] = useState<NginxRoute | null>(null);
  const [verifyingRouteId, setVerifyingRouteId] = useState<string | null>(null);

  const { data: routes, isLoading: routesLoading } = useNginxRoutes(infrastructureId);
  const { data: runners } = useRunners();
  const createRouteMutation = useCreateNginxRoute();
  const deleteRouteMutation = useDeleteNginxRoute();
  const updateRouteMutation = useUpdateNginxRoute();
  const createOrderMutation = useCreateOrder();

  // Find the associated runner
  const runner = useMemo(() => {
    if (runnerId) {
      return runners?.find((r) => r.id === runnerId);
    }
    return runners?.find((r) => r.infrastructure_id === infrastructureId);
  }, [runners, infrastructureId, runnerId]);

  const hasActiveRunner = runner?.status === "online";
  const hasOfflineRunner = runner && runner.status !== "online";

  // Generate Nginx configuration script
  const generateNginxScript = (
    domain: string,
    backendUrl: string,
    email: string = "admin@example.com"
  ): string => {
    return `#!/bin/bash
set -e

DOMAIN="${domain}"
BACKEND="${backendUrl}"
EMAIL="${email}"

echo "=== Configuring Nginx reverse proxy for $DOMAIN ==="

# Create Nginx config
cat > /etc/nginx/sites-available/$DOMAIN << 'NGINXCONF'
server {
    listen 80;
    server_name ${domain};

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name ${domain};

    ssl_certificate /etc/letsencrypt/live/${domain}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${domain}/privkey.pem;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    add_header Strict-Transport-Security "max-age=63072000" always;

    location / {
        proxy_pass ${backendUrl};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINXCONF

# Enable site
ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/

# Create certbot webroot directory
mkdir -p /var/www/certbot

# Test nginx config (without SSL first)
nginx -t

# Reload nginx for certbot challenge
systemctl reload nginx

# Obtain SSL certificate
certbot certonly --webroot -w /var/www/certbot -d $DOMAIN --non-interactive --agree-tos --email $EMAIL

# Reload nginx with SSL
systemctl reload nginx

echo "=== Nginx configuration complete for $DOMAIN ==="
echo '{"success": true, "domain": "'$DOMAIN'", "https_enabled": true}'
`;
  };

  // Handle creating a new route
  const handleCreateRoute = async (data: NginxRouteSubmitData) => {
    if (!infrastructureId) {
      toast.error("Aucune infrastructure sélectionnée");
      return;
    }

    try {
      const routesToCreate: { domain: string; subdomain: string | null; fullDomain: string }[] = [];

      if (data.routingType === "root_only") {
        routesToCreate.push({
          domain: data.domain,
          subdomain: null,
          fullDomain: data.domain,
        });
      } else if (data.routingType === "subdomain_only") {
        routesToCreate.push({
          domain: data.domain,
          subdomain: data.subdomain,
          fullDomain: `${data.subdomain}.${data.domain}`,
        });
      } else if (data.routingType === "root_and_subdomain") {
        routesToCreate.push({
          domain: data.domain,
          subdomain: null,
          fullDomain: data.domain,
        });
        routesToCreate.push({
          domain: data.domain,
          subdomain: data.subdomain,
          fullDomain: `${data.subdomain}.${data.domain}`,
        });
      }

      for (const route of routesToCreate) {
        const createdRoute = await createRouteMutation.mutateAsync({
          infrastructure_id: infrastructureId,
          domain: route.domain,
          subdomain: route.subdomain,
          full_domain: route.fullDomain,
          backend_host: data.backendHost,
          backend_port: data.backendPort,
          backend_protocol: data.backendProtocol,
          https_status: "pending",
        });

        // If we have an active runner, create the order to configure Nginx
        if (hasActiveRunner && runner) {
          const backendUrl = `${data.backendProtocol}://${data.backendHost}:${data.backendPort}`;
          const script = generateNginxScript(route.fullDomain, backendUrl);

          await createOrderMutation.mutateAsync({
            runner_id: runner.id,
            infrastructure_id: infrastructureId,
            name: `Nginx: Configure ${route.fullDomain}`,
            command: script,
            category: "installation",
            description: `Configuring Nginx reverse proxy with HTTPS for ${route.fullDomain} (route_id: ${createdRoute.id})`,
          });

          // Update route status to provisioning
          await updateRouteMutation.mutateAsync({
            id: createdRoute.id,
            https_status: "provisioning",
          });
        }

        onRouteCreated?.(createdRoute);
      }

      toast.success(
        routesToCreate.length > 1
          ? `${routesToCreate.length} routes Nginx créées`
          : "Route Nginx créée"
      );
      setIsAddDialogOpen(false);
    } catch (error) {
      console.error("Error creating Nginx route:", error);
      toast.error("Erreur lors de la création de la route");
    }
  };

  // Handle verifying/provisioning HTTPS for a route
  const handleVerifyRoute = async (route: NginxRoute) => {
    if (!runner || !hasActiveRunner) {
      toast.error("Aucun runner actif disponible");
      return;
    }

    setVerifyingRouteId(route.id);

    try {
      const fullDomain = route.full_domain || route.domain;
      const backendUrl = `${route.backend_protocol}://${route.backend_host}:${route.backend_port}`;
      const script = generateNginxScript(fullDomain, backendUrl);

      await createOrderMutation.mutateAsync({
        runner_id: runner.id,
        infrastructure_id: route.infrastructure_id,
        name: `Nginx: Provision HTTPS ${fullDomain}`,
        command: script,
        category: "installation",
        description: `Provisioning HTTPS certificate for ${fullDomain} (route_id: ${route.id})`,
      });

      await updateRouteMutation.mutateAsync({
        id: route.id,
        https_status: "provisioning",
      });

      toast.success(`Provisionnement HTTPS lancé pour ${fullDomain}`);
    } catch (error) {
      console.error("Error provisioning HTTPS:", error);
      toast.error("Erreur lors du provisionnement HTTPS");
    } finally {
      setVerifyingRouteId(null);
    }
  };

  // Handle deleting a route
  const handleDeleteRoute = async () => {
    if (!deleteRoute) return;

    try {
      // If HTTPS was configured, we should also create an order to remove the Nginx config
      if (deleteRoute.https_status === "ok" && hasActiveRunner && runner) {
        const fullDomain = deleteRoute.full_domain || deleteRoute.domain;
        const removeScript = `#!/bin/bash
set -e
DOMAIN="${fullDomain}"
echo "=== Removing Nginx config for $DOMAIN ==="
rm -f /etc/nginx/sites-enabled/$DOMAIN
rm -f /etc/nginx/sites-available/$DOMAIN
certbot delete --cert-name $DOMAIN --non-interactive || true
systemctl reload nginx
echo '{"success": true, "domain": "'$DOMAIN'", "removed": true}'
`;

        await createOrderMutation.mutateAsync({
          runner_id: runner.id,
          infrastructure_id: deleteRoute.infrastructure_id,
          name: `Nginx: Remove ${fullDomain}`,
          command: removeScript,
          category: "maintenance",
          description: `Removing Nginx configuration for ${fullDomain} (route_id: ${deleteRoute.id})`,
        });
      }

      await deleteRouteMutation.mutateAsync(deleteRoute.id);
      toast.success("Route supprimée");
      setDeleteRoute(null);
    } catch (error) {
      console.error("Error deleting route:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ok":
        return (
          <Badge variant="default" className="bg-green-600">
            <CheckCircle className="h-3 w-3 mr-1" />
            HTTPS OK
          </Badge>
        );
      case "provisioning":
        return (
          <Badge variant="secondary">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Provisionnement
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="outline">
            <Clock className="h-3 w-3 mr-1" />
            En attente
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive">
            <AlertCircle className="h-3 w-3 mr-1" />
            Échec
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <Clock className="h-3 w-3 mr-1" />
            {status}
          </Badge>
        );
    }
  };

  // Get consumed by badge
  const getConsumedByBadge = (consumedBy: string | null) => {
    if (!consumedBy) return <span className="text-muted-foreground text-sm">-</span>;

    if (consumedBy.startsWith("supabase:")) {
      return (
        <Badge variant="secondary">
          <Shield className="h-3 w-3 mr-1" />
          Supabase
        </Badge>
      );
    }

    if (consumedBy.startsWith("deployment:")) {
      return (
        <Badge variant="secondary">
          <ExternalLink className="h-3 w-3 mr-1" />
          Application
        </Badge>
      );
    }

    return <Badge variant="outline">{consumedBy}</Badge>;
  };

  if (!infrastructureId) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Veuillez sélectionner une infrastructure pour gérer les routes Nginx.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Registre des Domaines Nginx
            </CardTitle>
            <CardDescription>
              Gérez les routes Nginx reverse proxy avec certificats HTTPS via Certbot
            </CardDescription>
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)} disabled={!infrastructureId}>
            <Plus className="h-4 w-4 mr-2" />
            Ajouter un domaine
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {/* Runner Status Alerts */}
        {hasOfflineRunner && (
          <Alert className="mb-4" variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Le runner associé est hors ligne. Les configurations ne peuvent pas être appliquées.
            </AlertDescription>
          </Alert>
        )}

        {hasActiveRunner && (
          <Alert className="mb-4">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Runner actif détecté. Les configurations seront appliquées automatiquement.
            </AlertDescription>
          </Alert>
        )}

        {!runner && (
          <Alert className="mb-4" variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Aucun runner configuré pour cette infrastructure. Installez un runner pour appliquer les configurations.
            </AlertDescription>
          </Alert>
        )}

        {/* Routes Table */}
        {routesLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : routes && routes.length > 0 ? (
          <div className="rounded-md border overflow-x-auto">
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
                    <TableCell className="font-mono text-sm">
                      {route.full_domain || route.domain}
                      {route.subdomain && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          sous-domaine
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {route.backend_protocol}://{route.backend_host}:{route.backend_port}
                    </TableCell>
                    <TableCell>{getStatusBadge(route.https_status)}</TableCell>
                    <TableCell>{getConsumedByBadge(route.consumed_by)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {(route.https_status === "pending" || route.https_status === "failed") && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleVerifyRoute(route)}
                            disabled={!hasActiveRunner || verifyingRouteId === route.id}
                          >
                            {verifyingRouteId === route.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteRoute(route)}
                          disabled={!!route.consumed_by}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">Aucune route configurée</p>
            <p className="text-sm">
              Ajoutez un domaine pour configurer le reverse proxy Nginx avec HTTPS
            </p>
          </div>
        )}
      </CardContent>

      {/* Add Route Dialog */}
      <NginxRouteDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSubmit={handleCreateRoute}
        isLoading={createRouteMutation.isPending}
        hasActiveRunner={hasActiveRunner}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteRoute} onOpenChange={() => setDeleteRoute(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la route ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action supprimera la route{" "}
              <strong>{deleteRoute?.full_domain || deleteRoute?.domain}</strong> et sa
              configuration Nginx/certificat SSL associés. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRoute}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteRouteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
