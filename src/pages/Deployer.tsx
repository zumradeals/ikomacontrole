import { useState } from 'react';
import { Rocket, Plus, Play, History } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { useAppMode } from '@/contexts/AppModeContext';
import { useDeployments, useDeleteDeployment } from '@/hooks/useDeployments';
import { DeployWizard } from '@/components/deployer/DeployWizard';
import { DeploymentCard } from '@/components/deployer/DeploymentCard';
import { DeploymentRunner } from '@/components/deployer/DeploymentRunner';
import { Skeleton } from '@/components/ui/skeleton';

const Deployer = () => {
  const { isExpert } = useAppMode();
  const { data: deployments, isLoading } = useDeployments();
  const deleteDeployment = useDeleteDeployment();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [runnerOpen, setRunnerOpen] = useState(false);
  const [selectedDeploymentId, setSelectedDeploymentId] = useState<string | null>(null);

  const handleRun = (deploymentId: string) => {
    setSelectedDeploymentId(deploymentId);
    setRunnerOpen(true);
  };

  const handleView = (deploymentId: string) => {
    setSelectedDeploymentId(deploymentId);
    setRunnerOpen(true);
  };

  const handleDeploymentCreated = (deploymentId: string) => {
    setSelectedDeploymentId(deploymentId);
    setRunnerOpen(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Deployer"
        description="Déploiement et orchestration de vos applications"
        icon={Rocket}
        actions={
          <div className="flex items-center gap-2">
            {isExpert && (
              <Button variant="outline" size="sm">
                <History className="w-4 h-4 mr-2" />
                Historique
              </Button>
            )}
            <Button size="sm" onClick={() => setWizardOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Nouveau Déploiement
            </Button>
          </div>
        }
      />

      {/* Wizard Banner */}
      <div className="glass-panel rounded-xl p-6 glow-border">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
            <Rocket className="w-8 h-8 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-1">Déploiement Guidé</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Suivez l'assistant pour déployer votre application en 4 étapes simples
            </p>
            <Button onClick={() => setWizardOpen(true)}>
              <Play className="w-4 h-4 mr-2" />
              Lancer l'Assistant
            </Button>
          </div>
        </div>
      </div>

      {/* Deployments List */}
      <div className="glass-panel rounded-xl p-5">
        <h3 className="font-semibold mb-4">Déploiements Récents</h3>
        
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
          </div>
        ) : !deployments || deployments.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Rocket className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Aucun déploiement</p>
            <p className="text-sm mt-2">
              Créez votre premier déploiement pour commencer
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {deployments.map(deployment => (
              <DeploymentCard
                key={deployment.id}
                deployment={deployment}
                onRun={() => handleRun(deployment.id)}
                onView={() => handleView(deployment.id)}
                onDelete={() => deleteDeployment.mutate(deployment.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Wizard Dialog */}
      <DeployWizard 
        open={wizardOpen} 
        onOpenChange={setWizardOpen}
        onDeploymentCreated={handleDeploymentCreated}
      />

      {/* Runner Dialog */}
      <DeploymentRunner
        deploymentId={selectedDeploymentId}
        open={runnerOpen}
        onOpenChange={setRunnerOpen}
      />
    </div>
  );
};

export default Deployer;
