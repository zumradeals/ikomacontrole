import { useState } from 'react';
import { Copy, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Runner {
  id: string;
  name: string;
  status: string;
}

interface ReinstallScriptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  runner: Runner;
  baseUrl: string;
}

export function ReinstallScript({ open, onOpenChange, runner, baseUrl }: ReinstallScriptProps) {
  const [copied, setCopied] = useState(false);

  const reinstallScript = baseUrl
    ? `# Mise à jour du runner "${runner.name}"
# Arrêter le service actuel
sudo systemctl stop ikoma-runner

# Télécharger et remplacer le script runner
sudo curl -sSL ${baseUrl}/install-runner.sh -o /tmp/update-runner.sh

# Extraire le token existant de la config
TOKEN=$(sudo grep -oP 'TOKEN="\\K[^"]+' /opt/ikoma-runner/config 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "Erreur: Token non trouvé dans /opt/ikoma-runner/config"
  exit 1
fi

# Réinstaller avec le même token
bash /tmp/update-runner.sh --token "$TOKEN" --api-url ${baseUrl}

echo "Runner mis à jour avec succès!"`
    : '';

  const handleCopy = async () => {
    if (reinstallScript) {
      await navigator.clipboard.writeText(reinstallScript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            Réinstaller le runner
          </DialogTitle>
          <DialogDescription>
            Ce script mettra à jour le runner <strong>{runner.name}</strong> avec la dernière version 
            tout en conservant son token d'authentification.
          </DialogDescription>
        </DialogHeader>

        {!baseUrl ? (
          <div className="flex items-center gap-2 p-4 rounded-lg bg-orange-500/10 border border-orange-500/30 text-orange-400">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">Configurez l'URL de base de l'API pour générer le script</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-200">
                  <p className="font-medium mb-1">Nouvelles fonctionnalités incluses :</p>
                  <ul className="list-disc list-inside space-y-1 text-yellow-300/80">
                    <li>Polling des ordres toutes les 5 secondes</li>
                    <li>Exécution automatique des commandes</li>
                    <li>Rapport de statut en temps réel</li>
                    <li>Support de l'auto-détection des capacités</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Script de mise à jour</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  className="h-8"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 mr-1 text-green-500" />
                      Copié
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-1" />
                      Copier
                    </>
                  )}
                </Button>
              </div>
              
              <pre className="p-4 rounded-lg bg-muted/50 border border-border/50 overflow-x-auto max-h-80">
                <code className="text-sm font-mono text-foreground whitespace-pre">
                  {reinstallScript}
                </code>
              </pre>
              
              <p className="text-xs text-muted-foreground">
                Exécutez ce script sur le serveur où le runner est installé.
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
