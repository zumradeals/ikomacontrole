import { Link } from 'react-router-dom';
import { HardDrive, Server, Heart, Layers, Rocket, ChevronRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useInfrastructures } from '@/hooks/useInfrastructures';
import { useRunners } from '@/hooks/useRunners';
import { usePlatformInstances } from '@/hooks/usePlatformInstances';
import { useDeployments } from '@/hooks/useDeployments';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: typeof HardDrive;
  path: string;
  ctaLabel: string;
  isComplete: boolean;
}

export function OnboardingBanner() {
  const { data: infrastructures } = useInfrastructures();
  const { data: runners } = useRunners();
  const { data: platformInstances } = usePlatformInstances();
  const { data: deployments } = useDeployments();

  const hasInfra = (infrastructures?.length ?? 0) > 0;
  const hasRunner = (runners?.length ?? 0) > 0;
  const hasOnlineRunner = runners?.some(r => {
    if (!r.last_seen_at) return false;
    const lastSeen = new Date(r.last_seen_at).getTime();
    return Date.now() - lastSeen < 60000;
  });
  const hasService = (platformInstances?.filter(p => p.status === 'installed')?.length ?? 0) > 0;
  const hasDeployment = (deployments?.length ?? 0) > 0;

  const steps: OnboardingStep[] = [
    {
      id: 'infra',
      title: 'Déclarer un serveur',
      description: 'Enregistrez votre premier VPS ou serveur',
      icon: HardDrive,
      path: '/infra',
      ctaLabel: 'Ajouter',
      isComplete: hasInfra,
    },
    {
      id: 'runner',
      title: 'Installer un agent',
      description: 'Déployez l\'agent sur votre serveur',
      icon: Server,
      path: '/runner',
      ctaLabel: 'Installer',
      isComplete: hasRunner,
    },
    {
      id: 'health',
      title: 'Vérifier la connexion',
      description: 'Assurez-vous que l\'agent est en ligne',
      icon: Heart,
      path: '/runner',
      ctaLabel: 'Vérifier',
      isComplete: hasOnlineRunner ?? false,
    },
    {
      id: 'service',
      title: 'Activer un service',
      description: 'Docker, Redis, Supabase...',
      icon: Layers,
      path: '/platform',
      ctaLabel: 'Configurer',
      isComplete: hasService,
    },
    {
      id: 'deploy',
      title: 'Premier déploiement',
      description: 'Déployez votre application',
      icon: Rocket,
      path: '/deployer',
      ctaLabel: 'Déployer',
      isComplete: hasDeployment,
    },
  ];

  const completedCount = steps.filter(s => s.isComplete).length;
  const allComplete = completedCount === steps.length;

  // Don't show banner if all steps are complete
  if (allComplete) return null;

  // Find current step (first incomplete)
  const currentStepIndex = steps.findIndex(s => !s.isComplete);

  return (
    <div className="glass-panel rounded-xl p-5 glow-border">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-lg">Par où commencer ?</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {completedCount}/{steps.length} étapes complétées
          </p>
        </div>
        <div className="flex items-center gap-1">
          {steps.map((step, i) => (
            <div
              key={step.id}
              className={`w-2 h-2 rounded-full transition-colors ${
                step.isComplete 
                  ? 'bg-green-500' 
                  : i === currentStepIndex 
                    ? 'bg-primary animate-pulse' 
                    : 'bg-muted-foreground/30'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Steps */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = index === currentStepIndex;
          const isLocked = index > currentStepIndex && !step.isComplete;

          return (
            <Link
              key={step.id}
              to={step.path}
              className={`relative p-3 rounded-lg border transition-all ${
                step.isComplete
                  ? 'border-green-500/30 bg-green-500/5'
                  : isActive
                    ? 'border-primary/50 bg-primary/5 hover:bg-primary/10'
                    : isLocked
                      ? 'border-border/30 bg-muted/5 opacity-50 pointer-events-none'
                      : 'border-border/50 hover:border-primary/30'
              }`}
            >
              <div className="flex items-start gap-2">
                <div className={`p-1.5 rounded-md ${
                  step.isComplete 
                    ? 'bg-green-500/20' 
                    : isActive 
                      ? 'bg-primary/20' 
                      : 'bg-muted/20'
                }`}>
                  {step.isComplete ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : (
                    <Icon className={`w-4 h-4 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${
                    step.isComplete ? 'text-green-400' : isActive ? 'text-foreground' : 'text-muted-foreground'
                  }`}>
                    {step.title}
                  </p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {step.description}
                  </p>
                </div>
              </div>
              {isActive && (
                <div className="absolute -right-1 top-1/2 -translate-y-1/2">
                  <ChevronRight className="w-4 h-4 text-primary animate-pulse" />
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
