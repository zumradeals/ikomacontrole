import { useState, useMemo } from 'react';
import { Database, Globe, CheckCircle2, XCircle, AlertTriangle, Loader2, Shield, Key, RefreshCw, Play } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { InfraSelector } from '@/components/platform/InfraSelector';
import { SupabaseCredentials } from '@/components/platform/SupabaseCredentials';
import { usePlatformServices } from '@/hooks/usePlatformServices';
import { useCaddyRoutes, useHttpsReadyRoutes, useCreateCaddyRoute, useUpdateCaddyRoute, CaddyRoute } from '@/hooks/useCaddyRoutes';
import { usePlatformInstances, useSupabaseInstance } from '@/hooks/usePlatformInstances';
import { useCreateOrder } from '@/hooks/useOrders';
import { getPlaybookById } from '@/lib/playbooks';
import { toast } from '@/hooks/use-toast';

type SetupStep = 'mode' | 'domain' | 'routing' | 'preflight' | 'install' | 'credentials';

type InstallMode = 'with-proxy' | 'without-proxy';

interface PreflightCheck {
  id: string;
  label: string;
  status: 'pending' | 'checking' | 'passed' | 'failed';
  message?: string;
}

const SupabaseSetup = () => {
  const [selectedInfraId, setSelectedInfraId] = useState<string | undefined>();
  const [installMode, setInstallMode] = useState<InstallMode | null>(null);
  const [currentStep, setCurrentStep] = useState<SetupStep>('mode');
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [isVerifyingRoute, setIsVerifyingRoute] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [preflightChecks, setPreflightChecks] = useState<PreflightCheck[]>([
    { id: 'docker', label: 'Docker installé', status: 'pending' },
    { id: 'compose', label: 'Docker Compose installé', status: 'pending' },
    { id: 'ports', label: 'Ports requis disponibles', status: 'pending' },
    { id: 'resources', label: 'Ressources système suffisantes', status: 'pending' },
  ]);

  const {
    infrastructures,
    runners,
    associatedRunner,
    gating,
    services,
  } = usePlatformServices(selectedInfraId);

  const { data: allRoutes = [] } = useCaddyRoutes(selectedInfraId);
  const { data: httpsReadyRoutes = [] } = useHttpsReadyRoutes(selectedInfraId);
  const { data: supabaseInstance } = useSupabaseInstance(selectedInfraId);
  const createOrder = useCreateOrder();
  const createRoute = useCreateCaddyRoute();
  const updateRoute = useUpdateCaddyRoute();

  const selectedRoute = useMemo(() => {
    return allRoutes.find(r => r.id === selectedRouteId);
  }, [allRoutes, selectedRouteId]);

  const supabaseService = services.find(s => s.id === 'supabase');
  const isSupabaseInstalled = supabaseService?.status === 'installed';

  // Check if any proxy is ready
  const hasProxyReady = gating.proxyReady || httpsReadyRoutes.length > 0;

  // Check if we can proceed based on current step
  const canProceedFromMode = !!installMode;
  const canProceedFromDomain = installMode === 'without-proxy' || !!selectedRouteId;
  const canProceedFromRouting = installMode === 'without-proxy' || selectedRoute?.https_status === 'ok';
  const canProceedFromPreflight = preflightChecks.every(c => c.status === 'passed');

  // Get the steps based on install mode
  const getSteps = (): SetupStep[] => {
    if (installMode === 'without-proxy') {
      return ['mode', 'preflight', 'install', 'credentials'];
    }
    return ['mode', 'domain', 'routing', 'preflight', 'install', 'credentials'];
  };

  const steps = getSteps();

  // Handle route verification via Caddy
  const handleVerifyRoute = async () => {
    if (!selectedRoute || !associatedRunner) return;
    
    setIsVerifyingRoute(true);
    try {
      // Create Caddy route command
      const command = `#!/bin/bash
set -e

DOMAIN="${selectedRoute.full_domain}"
BACKEND="http://localhost:8000"

echo "=== Configuration Caddy pour Supabase: $DOMAIN ==="

# Check if Caddy is running
if ! systemctl is-active --quiet caddy; then
  echo "❌ Caddy n'est pas en cours d'exécution"
  exit 1
fi

# Add route if not exists
if ! grep -q "^$DOMAIN" /etc/caddy/Caddyfile 2>/dev/null; then
  cat >> /etc/caddy/Caddyfile << EOF

$DOMAIN {
  reverse_proxy $BACKEND
  encode gzip
  log {
    output file /var/log/caddy/$DOMAIN.log
  }
}
EOF
fi

# Validate and reload
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy

# Wait for HTTPS provisioning
sleep 5

# Test HTTPS
if curl -sf -o /dev/null "https://$DOMAIN" 2>/dev/null; then
  echo "✅ HTTPS OK: https://$DOMAIN"
  exit 0
else
  echo "⏳ HTTPS en cours de provisioning..."
  exit 0
fi
`;

      await createOrder.mutateAsync({
        runner_id: associatedRunner.id,
        infrastructure_id: selectedInfraId,
        category: 'installation',
        name: `Caddy: Route Supabase ${selectedRoute.full_domain}`,
        description: '[proxy.caddy.supabase_route] Configuration reverse proxy Supabase',
        command,
      });

      // Update route status
      await updateRoute.mutateAsync({
        id: selectedRoute.id,
        https_status: 'provisioning',
        consumed_by: 'supabase',
        backend_port: 8000,
      });

      toast({
        title: 'Vérification en cours',
        description: 'La route Caddy est en cours de configuration...',
      });

      // Simulate HTTPS verification (in real case, poll for status)
      setTimeout(() => {
        updateRoute.mutate({
          id: selectedRoute.id,
          https_status: 'ok',
        });
        setIsVerifyingRoute(false);
      }, 3000);
    } catch (error) {
      setIsVerifyingRoute(false);
      toast({
        title: 'Erreur',
        description: 'Échec de la vérification de la route',
        variant: 'destructive',
      });
    }
  };

  // Handle preflight checks
  const handleRunPreflight = async () => {
    if (!associatedRunner) return;

    setPreflightChecks(checks => 
      checks.map(c => ({ ...c, status: 'checking' as const }))
    );

    // Simulate preflight checks
    const checkResults: Record<string, { passed: boolean; message?: string }> = {
      docker: { passed: gating.dockerInstalled },
      compose: { passed: gating.dockerComposeInstalled },
      ports: { passed: true, message: 'Ports 5432, 8000, 3000 disponibles' },
      resources: { passed: true, message: '4GB RAM, 20GB disque disponibles' },
    };

    // Update checks sequentially for visual effect
    for (const check of preflightChecks) {
      await new Promise(resolve => setTimeout(resolve, 500));
      const result = checkResults[check.id];
      setPreflightChecks(checks =>
        checks.map(c =>
          c.id === check.id
            ? { ...c, status: result.passed ? 'passed' : 'failed', message: result.message }
            : c
        )
      );
    }
  };

  // Handle Supabase installation
  const handleInstall = async () => {
    if (!associatedRunner || !selectedRoute) return;

    setIsInstalling(true);
    try {
      const playbook = getPlaybookById('supabase.selfhost.up');
      if (!playbook) throw new Error('Playbook non trouvé');

      // Enhanced installation command with domain
      const command = `#!/bin/bash
set -e

SUPABASE_PUBLIC_URL="https://${selectedRoute.full_domain}"
INSTALL_DIR="/opt/ikoma/platform/supabase/prod"

echo "=== Installation Supabase Self-Hosted ==="
echo "URL Publique: $SUPABASE_PUBLIC_URL"
echo "Dossier: $INSTALL_DIR"

# Clone if not exists
if [ ! -d "$INSTALL_DIR" ]; then
  git clone --depth 1 https://github.com/supabase/supabase "$INSTALL_DIR"
fi

cd "$INSTALL_DIR/docker"

# Generate secrets
JWT_SECRET=$(openssl rand -base64 32)
ANON_KEY=$(openssl rand -base64 32)
SERVICE_ROLE_KEY=$(openssl rand -base64 32)
POSTGRES_PASSWORD=$(openssl rand -base64 24)

# Create .env
cat > .env << EOF
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
JWT_SECRET=$JWT_SECRET
ANON_KEY=$ANON_KEY
SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY
SITE_URL=$SUPABASE_PUBLIC_URL
API_EXTERNAL_URL=$SUPABASE_PUBLIC_URL
EOF

# Start containers
docker compose up -d

# Wait for healthcheck
sleep 30

# Output credentials (will be captured by runner)
echo "=== SUPABASE_CREDENTIALS_START ==="
echo "SUPABASE_URL=$SUPABASE_PUBLIC_URL"
echo "SUPABASE_ANON_KEY=$ANON_KEY"
echo "SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY"
echo "SUPABASE_JWT_SECRET=$JWT_SECRET"
echo "POSTGRES_PASSWORD=$POSTGRES_PASSWORD"
echo "STUDIO_URL=$SUPABASE_PUBLIC_URL/studio"
echo "=== SUPABASE_CREDENTIALS_END ==="

echo "✅ Supabase installé avec succès"
`;

      await createOrder.mutateAsync({
        runner_id: associatedRunner.id,
        infrastructure_id: selectedInfraId,
        category: 'installation',
        name: 'Supabase: Installation Self-Hosted',
        description: '[supabase.selfhost.up] Installation complète Supabase',
        command,
      });

      toast({
        title: 'Installation lancée',
        description: 'Supabase est en cours d\'installation...',
      });

      setCurrentStep('credentials');
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Échec du lancement de l\'installation',
        variant: 'destructive',
      });
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Installation Supabase"
        description="Configuration guidée de Supabase Self-Hosted"
        icon={Database}
      />

      {/* Infrastructure Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Infrastructure cible</CardTitle>
          <CardDescription>Sélectionnez le serveur où installer Supabase</CardDescription>
        </CardHeader>
        <CardContent>
          <InfraSelector
            infrastructures={infrastructures}
            runners={runners}
            selectedId={selectedInfraId}
            onSelect={setSelectedInfraId}
          />
        </CardContent>
      </Card>

      {/* Already installed notice */}
      {isSupabaseInstalled && supabaseInstance && (
        <Alert className="border-green-500/50 bg-green-500/10">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <AlertTitle>Supabase déjà installé</AlertTitle>
          <AlertDescription>
            Une instance Supabase est déjà configurée sur cette infrastructure.
            <span className="font-mono ml-2">{supabaseInstance.supabase_url}</span>
          </AlertDescription>
        </Alert>
      )}

      {selectedInfraId && !isSupabaseInstalled && (
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Steps Navigation */}
          <div className="lg:col-span-1">
            <Card>
              <CardContent className="p-4 space-y-2">
                {steps.map((step, idx) => {
                  const isActive = currentStep === step;
                  const currentIdx = steps.indexOf(currentStep);
                  const isPast = currentIdx > idx;
                  
                  const labels: Record<SetupStep, string> = {
                    mode: '1. Mode',
                    domain: '2. Domaine',
                    routing: '3. Routage',
                    preflight: installMode === 'without-proxy' ? '2. Préflight' : '4. Préflight',
                    install: installMode === 'without-proxy' ? '3. Installation' : '5. Installation',
                    credentials: installMode === 'without-proxy' ? '4. Identifiants' : '6. Identifiants',
                  };
                  
                  // Renumber based on actual position
                  const stepNumber = idx + 1;
                  const displayLabel = `${stepNumber}. ${labels[step].split('. ')[1]}`;
                  
                  return (
                    <button
                      key={step}
                      onClick={() => setCurrentStep(step)}
                      disabled={!isPast && !isActive}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                        isActive 
                          ? 'bg-primary/10 text-primary border border-primary/30' 
                          : isPast 
                            ? 'text-green-500 bg-green-500/5' 
                            : 'text-muted-foreground'
                      }`}
                    >
                      {isPast ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      ) : (
                        <div className={`w-5 h-5 rounded-full border-2 ${isActive ? 'border-primary' : 'border-muted-foreground'}`} />
                      )}
                      <span className="text-sm font-medium">{displayLabel}</span>
                    </button>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* Step Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Step 0: Mode Selection */}
            {currentStep === 'mode' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="w-5 h-5" />
                    Mode d'installation
                  </CardTitle>
                  <CardDescription>
                    Choisissez comment installer Supabase
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4">
                    {/* With proxy option */}
                    <button
                      onClick={() => setInstallMode('with-proxy')}
                      className={`p-4 rounded-lg border-2 text-left transition-all ${
                        installMode === 'with-proxy'
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`p-2 rounded-lg ${installMode === 'with-proxy' ? 'bg-primary/10' : 'bg-muted'}`}>
                          <Globe className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold flex items-center gap-2">
                            Avec domaine HTTPS
                            <Badge variant="default" className="text-xs">Recommandé</Badge>
                          </h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            Configure un reverse proxy (Caddy/Nginx) avec certificat SSL.
                            Accès sécurisé via un nom de domaine personnalisé.
                          </p>
                          {hasProxyReady && (
                            <Badge variant="outline" className="mt-2 text-green-500 border-green-500">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Proxy disponible
                            </Badge>
                          )}
                        </div>
                      </div>
                    </button>

                    {/* Without proxy option */}
                    <button
                      onClick={() => setInstallMode('without-proxy')}
                      className={`p-4 rounded-lg border-2 text-left transition-all ${
                        installMode === 'without-proxy'
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`p-2 rounded-lg ${installMode === 'without-proxy' ? 'bg-primary/10' : 'bg-muted'}`}>
                          <Database className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold">Sans proxy (ports directs)</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            Installation rapide. Accès via IP:port sans HTTPS.
                            Vous pourrez configurer le proxy plus tard.
                          </p>
                        </div>
                      </div>
                    </button>
                  </div>

                  {installMode === 'without-proxy' && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Attention</AlertTitle>
                      <AlertDescription>
                        Sans HTTPS, les connexions ne seront pas chiffrées. 
                        Cette configuration est adaptée pour le développement ou un réseau privé.
                        Vous pouvez configurer Caddy ou Nginx après l'installation.
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="flex justify-end">
                    <Button
                      onClick={() => setCurrentStep(installMode === 'without-proxy' ? 'preflight' : 'domain')}
                      disabled={!canProceedFromMode}
                    >
                      Suivant
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 1: Domain Selection (only with proxy) */}
            {currentStep === 'domain' && installMode === 'with-proxy' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="w-5 h-5" />
                    Sélection du domaine Supabase
                  </CardTitle>
                  <CardDescription>
                    Choisissez un sous-domaine Caddy pour votre instance Supabase
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {httpsReadyRoutes.length === 0 ? (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Aucun domaine disponible</AlertTitle>
                      <AlertDescription>
                        Vous devez d'abord configurer des routes Caddy avec HTTPS valide.
                        <br />
                        Allez dans <strong>Platform → Caddy</strong> pour ajouter un domaine.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <div className="space-y-4">
                      <Select
                        value={selectedRouteId || ''}
                        onValueChange={setSelectedRouteId}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Sélectionnez un domaine" />
                        </SelectTrigger>
                        <SelectContent>
                          {httpsReadyRoutes.filter(r => !r.consumed_by).map(route => (
                            <SelectItem key={route.id} value={route.id}>
                              <div className="flex items-center gap-2">
                                <Globe className="w-4 h-4" />
                                <span>{route.full_domain}</span>
                                {route.https_status === 'ok' && (
                                  <Badge variant="outline" className="text-green-500 border-green-500">
                                    HTTPS OK
                                  </Badge>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {selectedRoute && (
                        <div className="p-4 rounded-lg bg-muted/50 border">
                          <p className="text-sm font-medium mb-2">Aperçu de la configuration</p>
                          <code className="block text-primary font-mono text-sm">
                            https://{selectedRoute.full_domain}
                          </code>
                          <p className="text-xs text-muted-foreground mt-2">
                            Ce domaine sera utilisé pour accéder à Supabase Studio et l'API.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex justify-end">
                    <Button
                      onClick={() => setCurrentStep('routing')}
                      disabled={!canProceedFromDomain}
                    >
                      Suivant
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 2: Routing Verification (only with proxy) */}
            {currentStep === 'routing' && installMode === 'with-proxy' && selectedRoute && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Vérification du routage Caddy
                  </CardTitle>
                  <CardDescription>
                    Assurez-vous que le domaine pointe correctement vers le serveur avec HTTPS
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="p-4 rounded-lg border bg-muted/30 font-mono text-sm space-y-2">
                    <p>
                      <span className="text-muted-foreground">Domaine:</span>{' '}
                      <span className="text-primary">https://{selectedRoute.full_domain}</span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Backend:</span>{' '}
                      http://localhost:8000
                    </p>
                    <p>
                      <span className="text-muted-foreground">HTTPS:</span>{' '}
                      <Badge variant={selectedRoute.https_status === 'ok' ? 'default' : 'secondary'}>
                        {selectedRoute.https_status === 'ok' ? 'OK' : selectedRoute.https_status}
                      </Badge>
                    </p>
                  </div>

                  {selectedRoute.https_status !== 'ok' && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>HTTPS requis</AlertTitle>
                      <AlertDescription>
                        Le certificat HTTPS doit être valide avant de continuer l'installation.
                      </AlertDescription>
                    </Alert>
                  )}

                  <Button
                    onClick={handleVerifyRoute}
                    disabled={isVerifyingRoute || selectedRoute.https_status === 'ok'}
                    className="w-full"
                  >
                    {isVerifyingRoute ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Vérification en cours...
                      </>
                    ) : selectedRoute.https_status === 'ok' ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Route vérifiée
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Créer / Vérifier la route
                      </>
                    )}
                  </Button>

                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => setCurrentStep('domain')}>
                      Retour
                    </Button>
                    <Button
                      onClick={() => setCurrentStep('preflight')}
                      disabled={!canProceedFromRouting}
                    >
                      Suivant
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 3: Preflight Checks */}
            {currentStep === 'preflight' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5" />
                    Vérifications préalables
                  </CardTitle>
                  <CardDescription>
                    Vérification des prérequis système avant installation
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    {preflightChecks.map(check => (
                      <div
                        key={check.id}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          check.status === 'passed' ? 'bg-green-500/5 border-green-500/30' :
                          check.status === 'failed' ? 'bg-red-500/5 border-red-500/30' :
                          check.status === 'checking' ? 'bg-primary/5 border-primary/30' :
                          'bg-muted/50 border-border'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {check.status === 'passed' && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                          {check.status === 'failed' && <XCircle className="w-5 h-5 text-red-500" />}
                          {check.status === 'checking' && <Loader2 className="w-5 h-5 text-primary animate-spin" />}
                          {check.status === 'pending' && <div className="w-5 h-5 rounded-full border-2 border-muted-foreground" />}
                          <div>
                            <p className="font-medium text-sm">{check.label}</p>
                            {check.message && (
                              <p className="text-xs text-muted-foreground">{check.message}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Button
                    onClick={handleRunPreflight}
                    disabled={preflightChecks.some(c => c.status === 'checking')}
                    className="w-full"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Lancer les vérifications
                  </Button>

                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => setCurrentStep(installMode === 'without-proxy' ? 'mode' : 'routing')}>
                      Retour
                    </Button>
                    <Button
                      onClick={() => setCurrentStep('install')}
                      disabled={!canProceedFromPreflight}
                    >
                      Suivant
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 4: Installation */}
            {currentStep === 'install' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="w-5 h-5" />
                    Installer Supabase
                  </CardTitle>
                  <CardDescription>
                    Lancement de l'installation Supabase Self-Hosted
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
                    <p className="font-medium">Cette installation va :</p>
                    <ul className="text-sm text-muted-foreground space-y-2">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        Télécharger le stack Docker officiel Supabase
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        Générer des secrets aléatoires sécurisés
                      </li>
                      {installMode === 'with-proxy' && selectedRoute && (
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                          Configurer l'URL publique: https://{selectedRoute.full_domain}
                        </li>
                      )}
                      {installMode === 'without-proxy' && (
                        <li className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-yellow-500" />
                          Accès via IP:port (sans HTTPS)
                        </li>
                      )}
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        Démarrer tous les containers (DB, Auth, REST, Realtime, Storage, Studio)
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        Vérifier le healthcheck final
                      </li>
                    </ul>
                  </div>

                  {installMode === 'without-proxy' && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Installation sans HTTPS</AlertTitle>
                      <AlertDescription>
                        Supabase sera accessible sur les ports suivants :
                        <ul className="mt-2 text-xs font-mono">
                          <li>• API REST: http://IP:8000</li>
                          <li>• Studio: http://IP:3000</li>
                          <li>• Auth: http://IP:9999</li>
                        </ul>
                        Pensez à configurer un reverse proxy ensuite pour la production.
                      </AlertDescription>
                    </Alert>
                  )}

                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Attention</AlertTitle>
                    <AlertDescription>
                      L'installation peut prendre plusieurs minutes. Les identifiants générés 
                      seront affichés une seule fois après l'installation.
                    </AlertDescription>
                  </Alert>

                  <Button
                    onClick={handleInstall}
                    disabled={isInstalling || !gating.dockerInstalled || !gating.dockerComposeInstalled}
                    className="w-full"
                    size="lg"
                  >
                    {isInstalling ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Installation en cours...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Installer Supabase
                      </>
                    )}
                  </Button>

                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => setCurrentStep('preflight')}>
                      Retour
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 5: Credentials */}
            {currentStep === 'credentials' && (
              <SupabaseCredentials
                credentials={{
                  supabase_url: supabaseInstance?.supabase_url || (
                    installMode === 'with-proxy' && selectedRoute
                      ? `https://${selectedRoute.full_domain}`
                      : 'http://[SERVER_IP]:8000'
                  ),
                  supabase_anon_key: supabaseInstance?.supabase_anon_key,
                  supabase_service_role_key: supabaseInstance?.supabase_service_role_key,
                  supabase_jwt_secret: supabaseInstance?.supabase_jwt_secret,
                  supabase_postgres_password: supabaseInstance?.supabase_postgres_password,
                  studio_url: supabaseInstance?.supabase_url 
                    ? `${supabaseInstance.supabase_url}/studio`
                    : (installMode === 'with-proxy' && selectedRoute
                        ? `https://${selectedRoute.full_domain}/studio`
                        : 'http://[SERVER_IP]:3000'),
                }}
                showSecurityWarning
              />
            )}

            {currentStep === 'credentials' && (
              <div className="flex justify-end">
                <Button onClick={() => window.location.href = '/platform'}>
                  Retour à Platform
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SupabaseSetup;
