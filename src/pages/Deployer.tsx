import { useState } from 'react';
import { Rocket, Plus, Play, History, RotateCcw } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { useAppMode } from '@/contexts/AppModeContext';
import { 
  useDeployments, 
  useDeleteDeployment, 
  useCreateRollbackDeployment,
  usePreviousDeployment,
  Deployment 
} from '@/hooks/useDeployments';
import { DeployWizard } from '@/components/deployer/DeployWizard';
import { DeploymentCard } from '@/components/deployer/DeploymentCard';
import { DeploymentRunner } from '@/components/deployer/DeploymentRunner';
import { Skeleton } from '@/components/ui/skeleton';
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
import { toast } from 'sonner';

const Deployer = () => {
  const { isExpert } = useAppMode();
  const { data: deployments, isLoading } = useDeployments();
  const deleteDeployment = useDeleteDeployment();
  const createRollback = useCreateRollbackDeployment();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [runnerOpen, setRunnerOpen] = useState(false);
  const [selectedDeploymentId, setSelectedDeploymentId] = useState<string | null>(null);
  const [rollbackDialogOpen, setRollbackDialogOpen] = useState(false);
  const [deploymentToRollback, setDeploymentToRollback] = useState<Deployment | null>(null);

  // Fetch previous deployment for rollback
  const { data: previousDeployment } = usePreviousDeployment(
    deploymentToRollback?.app_name || null,
    deploymentToRollback?.id
  );

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

  const handleRollbackRequest = (deployment: Deployment) => {
    setDeploymentToRollback(deployment);
    setRollbackDialogOpen(true);
  };

  const handleConfirmRollback = async () => {
    if (!deploymentToRollback || !previousDeployment) {
      toast.error('Aucune version précédente disponible pour le rollback');
      return;
    }

    try {
      const rollbackDeployment = await createRollback.mutateAsync({
        fromDeployment: deploymentToRollback,
        toDeployment: previousDeployment,
      });
      
      setRollbackDialogOpen(false);
      setDeploymentToRollback(null);
      
      // Launch the rollback runner
      setSelectedDeploymentId(rollbackDeployment.id);
      setRunnerOpen(true);
    } catch (error) {
      // Error handled by mutation
    }
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
                onRollback={() => handleRollbackRequest(deployment)}
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

      {/* Rollback Confirmation Dialog */}
      <AlertDialog open={rollbackDialogOpen} onOpenChange={setRollbackDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-orange-500" />
              Confirmer le Rollback
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Êtes-vous sûr de vouloir effectuer un rollback de{' '}
                  <strong>{deploymentToRollback?.app_name}</strong> ?
                </p>
                {previousDeployment ? (
                  <div className="p-3 rounded-lg bg-muted text-sm">
                    <p className="font-medium mb-1">Version de restauration :</p>
                    <p className="text-muted-foreground">
                      Branche: <code className="text-foreground">{previousDeployment.branch}</code>
                    </p>
                    <p className="text-muted-foreground">
                      Déployé le:{' '}
                      {previousDeployment.completed_at
                        ? new Date(previousDeployment.completed_at).toLocaleString('fr-FR')
                        : 'N/A'}
                    </p>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm">
                    <p className="text-destructive">
                      Aucune version précédente trouvée pour cette application.
                      Le rollback n'est pas possible.
                    </p>
                  </div>
                )}
                <p className="text-sm text-muted-foreground">
                  Cette action va arrêter l'application actuelle et restaurer la version précédente.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRollback}
              disabled={!previousDeployment || createRollback.isPending}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {createRollback.isPending ? 'Préparation...' : 'Confirmer le Rollback'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Deployer;
