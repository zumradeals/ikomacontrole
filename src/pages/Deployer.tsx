import { Rocket, Plus, Play, History } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { useAppMode } from '@/contexts/AppModeContext';

const Deployer = () => {
  const { isExpert } = useAppMode();

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
            <Button size="sm">
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
            <Button>
              <Play className="w-4 h-4 mr-2" />
              Lancer l'Assistant
            </Button>
          </div>
        </div>
      </div>

      {/* Deployments List */}
      <div className="glass-panel rounded-xl p-5">
        <h3 className="font-semibold mb-4">Déploiements Récents</h3>
        
        <div className="text-center py-12 text-muted-foreground">
          <Rocket className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Aucun déploiement</p>
          <p className="text-sm mt-2">
            Créez votre premier déploiement pour commencer
          </p>
        </div>
      </div>
    </div>
  );
};

export default Deployer;
