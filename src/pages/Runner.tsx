import { Server, RefreshCw, ExternalLink, HardDrive, Settings2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { ApiHealthCheck } from '@/components/runner/ApiHealthCheck';
import { RunnersTable } from '@/components/runner/RunnersTable';
import { RunnerInstallWizard } from '@/components/runner/RunnerInstallWizard';
import { ApiContractStatus } from '@/components/infra/ApiContractStatus';
// useRunners now uses admin-proxy internally (no more direct Supabase)
import { useRunners } from '@/hooks/useRunners';
import { useInfrastructures } from '@/hooks/useInfrastructures';

const Runner = () => {
  // useRunners now uses admin-proxy internally - no more divergence
  const { data: runners, refetch: refetchRunners, isLoading: runnersLoading } = useRunners();
  const { data: infrastructures } = useInfrastructures();

  const hasRunners = (runners?.length ?? 0) > 0;
  const hasInfra = (infrastructures?.length ?? 0) > 0;

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

      {/* API Status */}
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
        <ApiHealthCheck />
      </div>

      {/* API Contract Diagnostic */}
      <ApiContractStatus />

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

      {/* Installation Wizard */}
      <div className="glass-panel rounded-xl p-4 sm:p-5 glow-border">
        <div className="flex items-center gap-2 mb-4">
          <Settings2 className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-sm sm:text-base">Installation Agent</h3>
        </div>

        {!hasInfra && (
          <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
            <p className="text-sm">
              💡 <strong>Conseil :</strong> déclarez d'abord un serveur dans la section Serveurs avant d'installer un agent.
            </p>
            <Link to="/infra" className="inline-block mt-2">
              <Button variant="outline" size="sm">
                <HardDrive className="w-4 h-4 mr-2" />
                Déclarer un serveur
              </Button>
            </Link>
          </div>
        )}

        <RunnerInstallWizard />
      </div>
    </div>
  );
};

export default Runner;
