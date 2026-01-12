import { AlertTriangle, CheckCircle2, Server, Container, Layers, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PlatformGating as GatingType } from '@/hooks/usePlatformServices';

interface PlatformGatingProps {
  gating: GatingType;
  onInstallPrerequisites?: () => void;
  isLoading?: boolean;
}

export function PlatformGating({ gating, onInstallPrerequisites, isLoading }: PlatformGatingProps) {
  const checks = [
    {
      label: 'Infrastructure',
      met: gating.hasInfra,
      icon: Server,
    },
    {
      label: 'Runner associé',
      met: gating.hasRunner,
      icon: Wifi,
    },
    {
      label: 'Runner en ligne',
      met: gating.runnerOnline,
      icon: Wifi,
      hidden: !gating.hasRunner,
    },
    {
      label: 'Docker Engine',
      met: gating.dockerInstalled,
      icon: Container,
    },
    {
      label: 'Docker Compose',
      met: gating.dockerComposeInstalled,
      icon: Layers,
    },
  ].filter(c => !c.hidden);

  const prereqsMissing = !gating.dockerInstalled || !gating.dockerComposeInstalled;
  const canInstallPrereqs = gating.hasInfra && gating.hasRunner && gating.runnerOnline && prereqsMissing;

  if (gating.allMet) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400">
        <CheckCircle2 className="w-4 h-4" />
        <span className="text-sm font-medium">Tous les prérequis sont satisfaits</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium">Prérequis non satisfaits</p>
          <p className="text-xs mt-1 opacity-80">
            Certains prérequis doivent être installés avant d'utiliser les services plateforme.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {checks.map((check) => {
          const Icon = check.icon;
          return (
            <div
              key={check.label}
              className={`
                flex items-center gap-2 px-3 py-2 rounded-lg border text-sm
                ${check.met 
                  ? 'bg-green-500/10 border-green-500/30 text-green-400' 
                  : 'bg-muted/50 border-border text-muted-foreground'
                }
              `}
            >
              {check.met ? (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              ) : (
                <Icon className="w-4 h-4 flex-shrink-0" />
              )}
              <span className="truncate">{check.label}</span>
            </div>
          );
        })}
      </div>

      {canInstallPrereqs && onInstallPrerequisites && (
        <Button 
          onClick={onInstallPrerequisites} 
          disabled={isLoading}
          className="w-full sm:w-auto"
        >
          <Container className="w-4 h-4 mr-2" />
          Installer Docker + Compose
        </Button>
      )}
    </div>
  );
}
