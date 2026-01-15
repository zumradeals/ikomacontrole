import { useState, useMemo } from 'react';
import { Copy, Check, AlertCircle, AlertTriangle, ShieldAlert, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useApiUrls } from '@/hooks/useApiUrls';

export function InstallScript() {
  const [token, setToken] = useState('');
  const [tokenGenerated, setTokenGenerated] = useState(false);
  const [showToken, setShowToken] = useState(true);
  const [copied, setCopied] = useState(false);
  
  const { baseUrl, installScriptUrl, validateInstallUrl, buildInstallCommand, isLoading } = useApiUrls();

  const generateToken = () => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const newToken = Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
    setToken(newToken);
    setTokenGenerated(true);
    setShowToken(true); // Show token on generation
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

  // Show error if URL is misconfigured (contains /v1/)
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
      {/* URL Verification */}
      <div className="text-xs p-3 rounded-lg bg-muted/30 border border-border/50 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Script URL:</span>
          <code className="text-primary">{installScriptUrl}</code>
          {!installScriptUrl.includes('/v1/') && (
            <Check className="w-3 h-3 text-green-500" />
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">API URL:</span>
          <code className="text-primary">{baseUrl}</code>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="runner-token">Token d'authentification</Label>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Input
              id="runner-token"
              type={showToken ? "text" : "password"}
              value={token}
              onChange={(e) => {
                setToken(e.target.value);
                setTokenGenerated(false);
              }}
              placeholder="Générez ou collez un token"
              className="font-mono text-sm pr-10"
              disabled={isLoading}
            />
            {token && (
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            )}
          </div>
          <Button variant="outline" onClick={generateToken} disabled={isLoading}>
            Générer
          </Button>
        </div>
        
        {/* Security warning */}
        {tokenGenerated && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
            <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-medium">⚠️ Conservez ce token précieusement !</p>
              <p>Il ne sera plus affiché après avoir quitté cette page. Copiez la commande d'installation maintenant.</p>
            </div>
          </div>
        )}
        
        <p className="text-xs text-muted-foreground">
          Ce token sera utilisé pour authentifier le runner lors de l'enregistrement.
        </p>
      </div>

      {token && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Commande d'installation</Label>
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
            Exécutez cette commande <strong>en tant que root</strong> sur votre serveur pour installer et enregistrer le runner.
          </p>
        </div>
      )}
    </div>
  );
}
