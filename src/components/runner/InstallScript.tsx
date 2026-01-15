import { useState, useMemo } from 'react';
import { Copy, Check, AlertCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useApiUrls } from '@/hooks/useApiUrls';

export function InstallScript() {
  const [token, setToken] = useState('');
  const [copied, setCopied] = useState(false);
  
  const { baseUrl, installScriptUrl, validateInstallUrl, buildInstallCommand, isLoading } = useApiUrls();

  const generateToken = () => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const newToken = Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
    setToken(newToken);
  };

  // Build install command using centralized function
  const installScript = useMemo(() => {
    if (!token || validateInstallUrl) return '';
    try {
      return buildInstallCommand(token);
    } catch {
      return '';
    }
  }, [token, validateInstallUrl, buildInstallCommand]);

  const handleCopy = async () => {
    if (installScript) {
      await navigator.clipboard.writeText(installScript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Show error if URL is misconfigured
  if (validateInstallUrl) {
    return (
      <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive">
        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium">Configuration invalide</p>
          <p className="text-xs opacity-80">{validateInstallUrl}</p>
        </div>
      </div>
    );
  }

  // Show warning if no base URL configured
  if (!baseUrl) {
    return (
      <div className="flex items-center gap-2 p-4 rounded-lg bg-orange-500/10 border border-orange-500/30 text-orange-400">
        <AlertCircle className="w-5 h-5 flex-shrink-0" />
        <p className="text-sm">Configurez l'URL de base de l'API dans Paramètres → Intégrations</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="runner-token">Token d'authentification</Label>
        <div className="flex gap-2">
          <Input
            id="runner-token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Générez ou collez un token"
            className="font-mono text-sm"
            disabled={isLoading}
          />
          <Button variant="outline" onClick={generateToken} disabled={isLoading}>
            Générer
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Ce token sera utilisé pour authentifier le runner. Conservez-le précieusement.
        </p>
      </div>

      {token && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Script d'installation</Label>
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
          
          <pre className="p-4 rounded-lg bg-muted/50 border border-border/50 overflow-x-auto">
            <code className="text-sm font-mono text-foreground break-all whitespace-pre-wrap">
              {installScript}
            </code>
          </pre>
          
          <p className="text-xs text-muted-foreground">
            Exécutez cette commande sur votre serveur pour installer et enregistrer le runner.
          </p>
        </div>
      )}
    </div>
  );
}
