import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, RefreshCw, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ServiceCard } from '@/components/platform/ServiceCard';
import { PlatformGating } from '@/components/platform/PlatformGating';
import { InfraSelector } from '@/components/platform/InfraSelector';
import { ServiceLogsDialog } from '@/components/platform/ServiceLogsDialog';
import { CaddyDomainRegistry } from '@/components/platform/CaddyDomainRegistry';
import { NginxDomainRegistry } from '@/components/platform/NginxDomainRegistry';
import { usePlatformServices, PREREQUISITE_PLAYBOOKS, PlatformService } from '@/hooks/usePlatformServices';
import { useCreateOrder } from '@/hooks/useOrders';
import { getPlaybookById } from '@/lib/playbooks';
import { toast } from '@/hooks/use-toast';

const Platform = () => {
  const navigate = useNavigate();
  const [selectedInfraId, setSelectedInfraId] = useState<string | undefined>();
  const [executingServiceId, setExecutingServiceId] = useState<string | null>(null);
  const [logsDialogOpen, setLogsDialogOpen] = useState(false);
  const [selectedServiceForLogs, setSelectedServiceForLogs] = useState<PlatformService | null>(null);

  const {
    infrastructures,
    runners,
    selectedInfra,
    associatedRunner,
    gating,
    services,
    orders,
  } = usePlatformServices(selectedInfraId);

  const createOrder = useCreateOrder();

  // Execute a playbook
  const executePlaybook = async (playbookId: string) => {
    if (!associatedRunner) {
      toast({
        title: 'Erreur',
        description: 'Aucun runner associé à cette infrastructure',
        variant: 'destructive',
      });
      return;
    }

    const playbook = getPlaybookById(playbookId);
    if (!playbook) {
      toast({
        title: 'Erreur',
        description: `Playbook ${playbookId} non trouvé`,
        variant: 'destructive',
      });
      return;
    }

    await createOrder.mutateAsync({
      runner_id: associatedRunner.id,
      infrastructure_id: selectedInfraId,
      category: 'installation',
      name: playbook.name,
      description: `[${playbook.id}] ${playbook.description}`,
      command: playbook.command,
    });
  };

  // Install prerequisites (Docker + Compose)
  const handleInstallPrerequisites = async () => {
    if (!associatedRunner) return;

    setExecutingServiceId('prerequisites');
    try {
      for (const playbookId of PREREQUISITE_PLAYBOOKS) {
        await executePlaybook(playbookId);
      }
      toast({
        title: 'Prérequis en cours d\'installation',
        description: 'Les ordres ont été envoyés au runner.',
      });
    } finally {
      setExecutingServiceId(null);
    }
  };

  // Service actions
  const handlePrecheck = async (service: PlatformService) => {
    if (!service.playbooks.precheck) return;
    
    setExecutingServiceId(service.id);
    try {
      await executePlaybook(service.playbooks.precheck);
    } finally {
      setExecutingServiceId(null);
    }
  };

  const handleInstall = async (service: PlatformService) => {
    setExecutingServiceId(service.id);
    try {
      for (const playbookId of service.playbooks.install) {
        await executePlaybook(playbookId);
      }
    } finally {
      setExecutingServiceId(null);
    }
  };

  const handleRefresh = async (service: PlatformService) => {
    if (!service.playbooks.status) return;
    
    setExecutingServiceId(service.id);
    try {
      await executePlaybook(service.playbooks.status);
    } finally {
      setExecutingServiceId(null);
    }
  };

  const handleViewLogs = (service: PlatformService) => {
    setSelectedServiceForLogs(service);
    setLogsDialogOpen(true);
  };

  // Verify Caddy runtime status
  const handleVerifyCaddy = useCallback(async () => {
    const verifyPlaybook = getPlaybookById('proxy.caddy.verify');
    if (!verifyPlaybook || !associatedRunner) return;
    
    setExecutingServiceId('caddy');
    try {
      await createOrder.mutateAsync({
        runner_id: associatedRunner.id,
        infrastructure_id: selectedInfraId,
        category: 'detection',
        name: 'Vérification Runtime Caddy',
        description: `[${verifyPlaybook.id}] ${verifyPlaybook.description}`,
        command: verifyPlaybook.command,
      });
      toast({
        title: 'Vérification lancée',
        description: 'L\'état de Caddy sera mis à jour sous peu.',
      });
    } finally {
      setExecutingServiceId(null);
    }
  }, [associatedRunner, selectedInfraId, createOrder]);

  // Navigate to Supabase Setup page
  const handleSupabaseSetup = (service: PlatformService) => {
    if (service.id === 'supabase' && selectedInfraId) {
      navigate(`/platform/supabase?infraId=${selectedInfraId}`);
    }
  };

  // Check if Caddy is ready for Supabase deployment
  const caddyNotReady = !gating.caddyVerified || !gating.caddyHttpsReady;

  // Filter orders for selected service
  const serviceOrders = useMemo(() => {
    if (!selectedServiceForLogs) return [];
    
    return orders.filter(o => 
      selectedServiceForLogs.playbooks.install.some(pb => o.description?.includes(`[${pb}]`)) ||
      (selectedServiceForLogs.playbooks.precheck && o.description?.includes(`[${selectedServiceForLogs.playbooks.precheck}]`)) ||
      (selectedServiceForLogs.playbooks.status && o.description?.includes(`[${selectedServiceForLogs.playbooks.status}]`))
    );
  }, [orders, selectedServiceForLogs]);

  // Count by status
  const statusCounts = useMemo(() => {
    return {
      installed: services.filter(s => s.status === 'installed').length,
      installing: services.filter(s => s.status === 'installing').length,
      failed: services.filter(s => s.status === 'failed').length,
      total: services.length,
    };
  }, [services]);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Platform"
        description="Services plateforme : Supabase, Redis, Caddy, Monitoring"
        icon={Layers}
      />

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="glass-panel p-1 flex-wrap">
          <TabsTrigger value="overview">
            Vue d'ensemble
            {statusCounts.installing > 0 && (
              <span className="ml-2 w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            )}
          </TabsTrigger>
          <TabsTrigger value="services">Services ({statusCounts.installed}/{statusCounts.total})</TabsTrigger>
          <TabsTrigger value="domains-caddy">Domaines Caddy</TabsTrigger>
          <TabsTrigger value="domains-nginx">Domaines Nginx</TabsTrigger>
          <TabsTrigger value="logs">Historique</TabsTrigger>
        </TabsList>

        {/* Infrastructure Selector */}
        <div className="glass-panel rounded-xl p-4">
          <InfraSelector
            infrastructures={infrastructures}
            runners={runners}
            selectedId={selectedInfraId}
            onSelect={setSelectedInfraId}
          />
        </div>

        {/* Gating Status */}
        {selectedInfraId && (
          <PlatformGating
            gating={gating}
            onInstallPrerequisites={handleInstallPrerequisites}
            isLoading={executingServiceId === 'prerequisites'}
          />
        )}

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {!selectedInfraId ? (
            <div className="glass-panel rounded-xl p-8 text-center">
              <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Aucune infrastructure sélectionnée</h3>
              <p className="text-muted-foreground">
                Sélectionnez une infrastructure pour voir et gérer les services plateforme.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {services.map((service) => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  onPrecheck={() => handlePrecheck(service)}
                  onInstall={service.id === 'supabase' ? () => handleSupabaseSetup(service) : () => handleInstall(service)}
                  onRefresh={() => handleRefresh(service)}
                  onViewLogs={() => handleViewLogs(service)}
                  onVerify={service.id === 'caddy' ? handleVerifyCaddy : undefined}
                  onConfigure={undefined}
                  disabled={!gating.hasRunner || !gating.runnerOnline}
                  isLoading={executingServiceId === service.id}
                  caddyNotReady={service.id === 'supabase' ? caddyNotReady : false}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Services Tab */}
        <TabsContent value="services" className="space-y-4">
          {!selectedInfraId ? (
            <div className="glass-panel rounded-xl p-8 text-center text-muted-foreground">
              Sélectionnez une infrastructure pour gérer les services.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Quick actions */}
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!gating.allMet || createOrder.isPending}
                  onClick={() => {
                    // Refresh all service statuses
                    services.forEach(s => {
                      if (s.status === 'installed' && s.playbooks.status) {
                        handleRefresh(s);
                      }
                    });
                  }}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Rafraîchir tous les statuts
                </Button>
              </div>

              {/* Service list */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {services.map((service) => (
                  <div key={service.id} className="glass-panel rounded-xl p-5">
                    <ServiceCard
                      service={service}
                      onPrecheck={() => handlePrecheck(service)}
                      onInstall={service.id === 'supabase' ? () => handleSupabaseSetup(service) : () => handleInstall(service)}
                      onRefresh={() => handleRefresh(service)}
                      onViewLogs={() => handleViewLogs(service)}
                      onVerify={service.id === 'caddy' ? handleVerifyCaddy : undefined}
                      onConfigure={undefined}
                      disabled={!gating.hasRunner || !gating.runnerOnline}
                      isLoading={executingServiceId === service.id}
                      caddyNotReady={service.id === 'supabase' ? caddyNotReady : false}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Caddy Domains Tab */}
        <TabsContent value="domains-caddy" className="space-y-4">
          {!selectedInfraId ? (
            <div className="glass-panel rounded-xl p-8 text-center text-muted-foreground">
              Sélectionnez une infrastructure pour gérer les domaines Caddy.
            </div>
          ) : (
            <CaddyDomainRegistry infrastructureId={selectedInfraId} />
          )}
        </TabsContent>

        {/* Nginx Domains Tab */}
        <TabsContent value="domains-nginx" className="space-y-4">
          {!selectedInfraId ? (
            <div className="glass-panel rounded-xl p-8 text-center text-muted-foreground">
              Sélectionnez une infrastructure pour gérer les domaines Nginx.
            </div>
          ) : (
            <NginxDomainRegistry infrastructureId={selectedInfraId} />
          )}
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs" className="space-y-4">
          {orders.length === 0 ? (
            <div className="glass-panel rounded-xl p-8 text-center text-muted-foreground">
              Aucun ordre exécuté pour cette infrastructure.
            </div>
          ) : (
            <div className="glass-panel rounded-xl p-4">
              <h3 className="font-semibold mb-4">Derniers ordres ({orders.length})</h3>
              <div className="space-y-2">
                {orders.slice(0, 20).map((order) => (
                  <div 
                    key={order.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{order.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(order.created_at).toLocaleString('fr-FR')}
                      </p>
                    </div>
                    <div className={`
                      px-2 py-1 rounded text-xs font-medium
                      ${order.status === 'completed' ? 'bg-green-500/10 text-green-400' : ''}
                      ${order.status === 'failed' ? 'bg-red-500/10 text-red-400' : ''}
                      ${order.status === 'running' ? 'bg-purple-500/10 text-purple-400' : ''}
                      ${order.status === 'pending' ? 'bg-muted text-muted-foreground' : ''}
                      ${order.status === 'cancelled' ? 'bg-amber-500/10 text-amber-400' : ''}
                    `}>
                      {order.status}
                      {order.exit_code !== null && ` (${order.exit_code})`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Service Logs Dialog */}
      <ServiceLogsDialog
        open={logsDialogOpen}
        onOpenChange={setLogsDialogOpen}
        serviceName={selectedServiceForLogs?.name || ''}
        orders={serviceOrders}
      />
    </div>
  );
};

export default Platform;
