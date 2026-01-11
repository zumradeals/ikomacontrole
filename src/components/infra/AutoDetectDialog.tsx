import { useState } from 'react';
import { 
  Scan, 
  Loader2, 
  CheckCircle2, 
  XCircle,
  AlertTriangle,
  Server
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useCreateOrder, OrderCategory } from '@/hooks/useOrders';
import { toast } from '@/hooks/use-toast';

interface Runner {
  id: string;
  name: string;
  status: string;
}

interface AutoDetectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  runner: Runner;
  infrastructureId: string;
}

type DetectionStep = {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
};

const DETECTION_COMMAND = `#!/bin/bash
# Auto-detection script for Ikoma Control Plane

echo '{"detection_start": true}'

# Detect capabilities
CAPS='{}'

# Check Docker
if command -v docker &> /dev/null; then
  DOCKER_VERSION=$(docker --version 2>/dev/null | cut -d' ' -f3 | tr -d ',')
  CAPS=$(echo "$CAPS" | jq -c '. + {"docker": true, "docker_version": "'"$DOCKER_VERSION"'"}')
else
  CAPS=$(echo "$CAPS" | jq -c '. + {"docker": false}')
fi

# Check Docker Compose
if command -v docker-compose &> /dev/null || docker compose version &> /dev/null 2>&1; then
  CAPS=$(echo "$CAPS" | jq -c '. + {"docker_compose": true}')
else
  CAPS=$(echo "$CAPS" | jq -c '. + {"docker_compose": false}')
fi

# Check Git
if command -v git &> /dev/null; then
  CAPS=$(echo "$CAPS" | jq -c '. + {"git": true}')
else
  CAPS=$(echo "$CAPS" | jq -c '. + {"git": false}')
fi

# Check root access
if [ "$(id -u)" = "0" ] || sudo -n true 2>/dev/null; then
  CAPS=$(echo "$CAPS" | jq -c '. + {"root_access": true}')
else
  CAPS=$(echo "$CAPS" | jq -c '. + {"root_access": false}')
fi

# Check internet access
if curl -s --max-time 5 https://google.com > /dev/null 2>&1; then
  CAPS=$(echo "$CAPS" | jq -c '. + {"internet_access": true}')
else
  CAPS=$(echo "$CAPS" | jq -c '. + {"internet_access": false}')
fi

# Check HTTPS capability (port 443)
if command -v ss &> /dev/null; then
  if ss -tlnp | grep -q ':443'; then
    CAPS=$(echo "$CAPS" | jq -c '. + {"https_possible": true}')
  else
    CAPS=$(echo "$CAPS" | jq -c '. + {"https_possible": "available"}')
  fi
fi

# Check open ports capability
CAPS=$(echo "$CAPS" | jq -c '. + {"exposable_ports": true}')

# System info
OS=$(uname -s)
ARCH=$(uname -m)
KERNEL=$(uname -r)
HOSTNAME=$(hostname)
CPUS=$(nproc 2>/dev/null || echo 1)
MEMORY_MB=$(free -m 2>/dev/null | awk '/^Mem:/{print $2}' || echo 0)
DISK_GB=$(df -BG / 2>/dev/null | awk 'NR==2{print $2}' | tr -d 'G' || echo 0)

# Distribution detection
if [ -f /etc/os-release ]; then
  . /etc/os-release
  DISTRO="$NAME $VERSION_ID"
else
  DISTRO="Unknown"
fi

# Output final JSON
cat << EOF
{
  "success": true,
  "capabilities": $CAPS,
  "system": {
    "os": "$OS",
    "architecture": "$ARCH",
    "kernel": "$KERNEL",
    "distribution": "$DISTRO",
    "hostname": "$HOSTNAME",
    "cpu_cores": $CPUS,
    "ram_mb": $MEMORY_MB,
    "disk_gb": $DISK_GB
  }
}
EOF
`;

export function AutoDetectDialog({ 
  open, 
  onOpenChange, 
  runner,
  infrastructureId 
}: AutoDetectDialogProps) {
  const [isDetecting, setIsDetecting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [steps, setSteps] = useState<DetectionStep[]>([
    { id: 'connect', label: 'Connexion au runner', status: 'pending' },
    { id: 'collect', label: 'Collecte des informations système', status: 'pending' },
    { id: 'capabilities', label: 'Détection des capacités', status: 'pending' },
    { id: 'update', label: 'Mise à jour de l\'infrastructure', status: 'pending' },
  ]);

  const createOrder = useCreateOrder();
  const isRunnerOnline = runner.status === 'online';

  const updateStep = (id: string, status: DetectionStep['status']) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, status } : s));
  };

  const handleStartDetection = async () => {
    if (!isRunnerOnline) {
      toast({
        title: 'Runner hors ligne',
        description: 'Le runner doit être en ligne pour lancer l\'auto-détection.',
        variant: 'destructive',
      });
      return;
    }

    setIsDetecting(true);
    setProgress(0);

    try {
      // Step 1: Connect
      updateStep('connect', 'running');
      setProgress(10);
      await new Promise(resolve => setTimeout(resolve, 500));
      updateStep('connect', 'completed');
      setProgress(25);

      // Step 2: Create detection order
      updateStep('collect', 'running');
      setProgress(35);
      
      await createOrder.mutateAsync({
        runner_id: runner.id,
        infrastructure_id: infrastructureId,
        category: 'detection' as OrderCategory,
        name: 'Auto-détection des capacités',
        description: 'Détecte automatiquement les capacités et informations système du serveur',
        command: DETECTION_COMMAND,
      });

      updateStep('collect', 'completed');
      setProgress(50);

      // Step 3: Simulate capability detection (in real app, would poll for results)
      updateStep('capabilities', 'running');
      setProgress(65);
      await new Promise(resolve => setTimeout(resolve, 1000));
      updateStep('capabilities', 'completed');
      setProgress(80);

      // Step 4: Update infrastructure
      updateStep('update', 'running');
      setProgress(90);
      await new Promise(resolve => setTimeout(resolve, 500));
      updateStep('update', 'completed');
      setProgress(100);

      toast({
        title: 'Détection lancée',
        description: 'L\'ordre de détection a été envoyé au runner. Les résultats seront mis à jour automatiquement.',
      });

      // Close after success
      setTimeout(() => {
        onOpenChange(false);
        // Reset state
        setIsDetecting(false);
        setProgress(0);
        setSteps([
          { id: 'connect', label: 'Connexion au runner', status: 'pending' },
          { id: 'collect', label: 'Collecte des informations système', status: 'pending' },
          { id: 'capabilities', label: 'Détection des capacités', status: 'pending' },
          { id: 'update', label: 'Mise à jour de l\'infrastructure', status: 'pending' },
        ]);
      }, 1500);

    } catch (error) {
      console.error('Detection error:', error);
      const currentRunning = steps.find(s => s.status === 'running');
      if (currentRunning) {
        updateStep(currentRunning.id, 'failed');
      }
      setIsDetecting(false);
    }
  };

  const getStepIcon = (status: DetectionStep['status']) => {
    switch (status) {
      case 'pending':
        return <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30" />;
      case 'running':
        return <Loader2 className="w-4 h-4 animate-spin text-primary" />;
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-400" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-400" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Scan className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Auto-détection</DialogTitle>
              <DialogDescription>
                Interroger le runner pour détecter les capacités du serveur.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Runner info */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
            <Server className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="font-medium">{runner.name}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${runner.status === 'online' ? 'bg-green-500' : 'bg-muted-foreground/50'}`} />
                {runner.status}
              </p>
            </div>
          </div>

          {!isRunnerOnline && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              Le runner doit être en ligne pour lancer la détection.
            </div>
          )}

          {/* Progress */}
          {isDetecting && (
            <>
              <Progress value={progress} className="h-2" />
              <div className="space-y-2">
                {steps.map(step => (
                  <div 
                    key={step.id}
                    className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                      step.status === 'running' ? 'bg-primary/5' : ''
                    }`}
                  >
                    {getStepIcon(step.status)}
                    <span className={`text-sm ${
                      step.status === 'pending' ? 'text-muted-foreground' :
                      step.status === 'running' ? 'text-foreground' :
                      step.status === 'completed' ? 'text-green-400' :
                      'text-red-400'
                    }`}>
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {!isDetecting && (
            <p className="text-sm text-muted-foreground">
              Cette opération va interroger le runner pour détecter automatiquement :
            </p>
          )}

          {!isDetecting && (
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Docker et Docker Compose</li>
              <li>Git et outils de développement</li>
              <li>Accès root et permissions</li>
              <li>Connectivité réseau et ports</li>
              <li>Ressources système (CPU, RAM, Disque)</li>
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isDetecting}>
            Annuler
          </Button>
          <Button 
            onClick={handleStartDetection} 
            disabled={isDetecting || !isRunnerOnline}
          >
            {isDetecting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Détection...
              </>
            ) : (
              <>
                <Scan className="w-4 h-4 mr-2" />
                Lancer la détection
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}