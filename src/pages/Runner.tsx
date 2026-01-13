import { Server, RefreshCw, Terminal, ExternalLink, Copy, HardDrive } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { useSetting } from '@/hooks/useSettings';
import { useAppMode } from '@/contexts/AppModeContext';
import { ApiHealthCheck } from '@/components/runner/ApiHealthCheck';
import { RunnersTable } from '@/components/runner/RunnersTable';
import { InstallScript } from '@/components/runner/InstallScript';
import { useRunners } from '@/hooks/useRunners';
import { useInfrastructures } from '@/hooks/useInfrastructures';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

const Runner = () => {
  const { value: runnerBaseUrl, isLoading: settingsLoading } = useSetting('runner_base_url');
  const { isExpert } = useAppMode();
  const { data: runners, refetch: refetchRunners, isLoading: runnersLoading } = useRunners();
  const { data: infrastructures } = useInfrastructures();

  const hasRunners = (runners?.length ?? 0) > 0;
  const hasInfra = (infrastructures?.length ?? 0) > 0;

  // Generate install script for copy
  const installScript = runnerBaseUrl 
    ? `curl -fsSL "${runnerBaseUrl}/install" | sudo bash`
    : '';

  const handleCopyScript = () => {
    navigator.clipboard.writeText(installScript);
    toast.success('Script copié dans le presse-papiers');
  };

  if (settingsLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <PageHeader
        title="Agents"
        description="Agents déployés sur vos serveurs pour exécuter les ordres"
        icon={Server}
        actions={
          <Button variant="outline" size="sm" onClick={() => refetchRunners()}>
            <RefreshCw className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Actualiser</span>
          </Button>
        }
      />

      {/* API Status (read-only) */}
      <div className="glass-panel rounded-xl p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm sm:text-base">État de l'API</h3>
          <Link to="/settings">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              <ExternalLink className="w-4 h-4 mr-1" />
              Gérer dans Paramètres
            </Button>
          </Link>
        </div>
        
        <ApiHealthCheck baseUrl={runnerBaseUrl} />
        
        {runnerBaseUrl && (
          <div className="mt-3 pt-3 border-t border-border/50">
            <p className="text-xs text-muted-foreground truncate">
              <span className="font-medium">URL :</span> {runnerBaseUrl}
            </p>
          </div>
        )}
      </div>

      {/* Empty state with CTA */}
      {!hasRunners && !runnersLoading && (
        <div className="glass-panel rounded-xl p-6 sm:p-8 glow-border">
          <div className="text-center">
            <Server className="w-12 h-12 mx-auto mb-4 text-primary opacity-50" />
            <h3 className="text-lg font-semibold mb-2">Aucun agent enregistré</h3>
            <p className="text-muted-foreground text-sm max-w-md mx-auto mb-6">
              Installez un agent sur votre serveur pour commencer à exécuter des ordres.
              {!hasInfra && (
                <span className="block mt-2 text-amber-400">
                  💡 Conseil : déclarez d'abord un serveur dans la section Serveurs.
                </span>
              )}
            </p>
            
            {runnerBaseUrl ? (
              <div className="space-y-4">
                <div className="bg-muted/30 rounded-lg p-4 font-mono text-sm text-left max-w-xl mx-auto overflow-x-auto">
                  <code className="text-primary">{installScript}</code>
                </div>
                <Button onClick={handleCopyScript} variant="default">
                  <Copy className="w-4 h-4 mr-2" />
                  Copier le script d'installation
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-amber-400 text-sm">
                  ⚠️ L'URL de l'API n'est pas configurée
                </p>
                <Link to="/settings">
                  <Button variant="outline">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Configurer dans Paramètres
                  </Button>
                </Link>
              </div>
            )}

            {!hasInfra && (
              <div className="mt-6 pt-6 border-t border-border/50">
                <Link to="/infra">
                  <Button variant="outline" size="sm">
                    <HardDrive className="w-4 h-4 mr-2" />
                    Déclarer un serveur
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Installation Script - Expert mode (only show if there are runners or in expert) */}
      {isExpert && runnerBaseUrl && (
        <div className="glass-panel rounded-xl p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <Terminal className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            <h3 className="font-semibold text-sm sm:text-base">Script d'Installation</h3>
          </div>
          
          <InstallScript baseUrl={runnerBaseUrl} />
        </div>
      )}

      {/* Runners Table */}
      {(hasRunners || runnersLoading) && (
        <div className="glass-panel rounded-xl p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className="font-semibold text-sm sm:text-base">Agents Enregistrés</h3>
            {hasRunners && (
              <span className="text-xs text-muted-foreground">
                {runners?.length} agent{(runners?.length ?? 0) > 1 ? 's' : ''}
              </span>
            )}
          </div>
          
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <RunnersTable />
          </div>
        </div>
      )}
    </div>
  );
};

export default Runner;
