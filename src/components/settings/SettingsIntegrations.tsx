import { Link2, Key, GitBranch, Webhook, RefreshCw, Eye, EyeOff, Copy, Save, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiHealthCheck } from '@/components/runner/ApiHealthCheck';
import { toast } from 'sonner';
import { useState, useEffect, useMemo } from 'react';
import { useSettings } from '@/hooks/useSettings';

// Setting keys for API URLs
const SETTING_API_BASE_URL = 'orders_api_base_url';
const SETTING_API_V1_URL = 'orders_api_v1_url';

// Default values (fallback if no setting exists)
const DEFAULT_API_BASE_URL = 'https://api.ikomadigit.com';
const DEFAULT_API_V1_URL = 'https://api.ikomadigit.com/v1';

export function SettingsIntegrations() {
  const [showToken, setShowToken] = useState(false);
  const { getSetting, updateSetting, isLoading, isUpdating } = useSettings();
  
  // Local draft state for URLs
  const [baseUrl, setBaseUrl] = useState('');
  const [v1Url, setV1Url] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  // Load saved values
  const savedBaseUrl = getSetting(SETTING_API_BASE_URL) || DEFAULT_API_BASE_URL;
  const savedV1Url = getSetting(SETTING_API_V1_URL) || DEFAULT_API_V1_URL;

  // Sync local state with saved values on load
  useEffect(() => {
    if (!isDirty) {
      setBaseUrl(savedBaseUrl);
      setV1Url(savedV1Url);
    }
  }, [savedBaseUrl, savedV1Url, isDirty]);

  // Validation
  const validation = useMemo(() => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check base URL doesn't contain /v1
    if (baseUrl.includes('/v1')) {
      errors.push('L\'URL de base ne doit pas contenir /v1');
    }

    // Check V1 URL ends with /v1
    if (!v1Url.endsWith('/v1')) {
      warnings.push('L\'URL V1 devrait se terminer par /v1');
    }

    // Check URLs are valid
    try {
      new URL(baseUrl);
    } catch {
      if (baseUrl) errors.push('URL de base invalide');
    }

    try {
      new URL(v1Url);
    } catch {
      if (v1Url) errors.push('URL V1 invalide');
    }

    // Check consistency - V1 URL should start with base URL
    if (baseUrl && v1Url && !v1Url.startsWith(baseUrl)) {
      warnings.push('L\'URL V1 devrait commencer par l\'URL de base');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }, [baseUrl, v1Url]);

  const handleBaseUrlChange = (value: string) => {
    setBaseUrl(value);
    setIsDirty(true);
    
    // Auto-update V1 URL if it was derived from base URL
    if (!isDirty || v1Url === `${savedBaseUrl}/v1`) {
      setV1Url(`${value}/v1`);
    }
  };

  const handleV1UrlChange = (value: string) => {
    setV1Url(value);
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (!validation.isValid) {
      toast.error('Corrigez les erreurs avant de sauvegarder');
      return;
    }

    try {
      await updateSetting(SETTING_API_BASE_URL, baseUrl);
      await updateSetting(SETTING_API_V1_URL, v1Url);
      setIsDirty(false);
      toast.success('Configuration API sauvegardée');
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde');
    }
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('URL copiée');
  };

  const handleReset = () => {
    setBaseUrl(savedBaseUrl);
    setV1Url(savedV1Url);
    setIsDirty(false);
  };

  return (
    <div className="space-y-6">
      {/* Orders API */}
      <div className="glass-panel rounded-xl p-6 space-y-6">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Link2 className="w-4 h-4 text-primary" />
            API Orders (IKOMA)
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Configuration des URLs de l'API externe
          </p>
        </div>
        
        <div className="space-y-4">
          {/* Base URL */}
          <div className="space-y-2">
            <Label htmlFor="api-base-url">
              URL de base
              <span className="text-xs text-muted-foreground ml-2">
                (endpoints: /health, /ready, /install-runner.sh)
              </span>
            </Label>
            <div className="flex gap-2">
              <Input
                id="api-base-url"
                value={baseUrl}
                onChange={(e) => handleBaseUrlChange(e.target.value)}
                placeholder={DEFAULT_API_BASE_URL}
                className="font-mono text-sm"
                disabled={isLoading}
              />
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => handleCopyUrl(baseUrl)}
                title="Copier"
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* V1 URL */}
          <div className="space-y-2">
            <Label htmlFor="api-v1-url">
              URL V1
              <span className="text-xs text-muted-foreground ml-2">
                (endpoints métier: /v1/*)
              </span>
            </Label>
            <div className="flex gap-2">
              <Input
                id="api-v1-url"
                value={v1Url}
                onChange={(e) => handleV1UrlChange(e.target.value)}
                placeholder={DEFAULT_API_V1_URL}
                className="font-mono text-sm"
                disabled={isLoading}
              />
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => handleCopyUrl(v1Url)}
                title="Copier"
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Validation messages */}
          {(validation.errors.length > 0 || validation.warnings.length > 0) && (
            <div className="space-y-2">
              {validation.errors.map((error, i) => (
                <div key={`error-${i}`} className="flex items-center gap-2 text-sm text-destructive">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              ))}
              {validation.warnings.map((warning, i) => (
                <div key={`warning-${i}`} className="flex items-center gap-2 text-sm text-amber-500">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {warning}
                </div>
              ))}
            </div>
          )}

          {/* Save/Reset buttons */}
          {isDirty && (
            <div className="flex items-center gap-3 pt-2">
              <Button 
                onClick={handleSave} 
                disabled={!validation.isValid || isUpdating}
                size="sm"
              >
                <Save className="w-4 h-4 mr-2" />
                {isUpdating ? 'Sauvegarde...' : 'Sauvegarder'}
              </Button>
              <Button 
                variant="ghost" 
                onClick={handleReset}
                disabled={isUpdating}
                size="sm"
              >
                Annuler
              </Button>
              {validation.isValid && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-green-500" />
                  Configuration valide
                </span>
              )}
            </div>
          )}

          {/* API Health */}
          <div className="pt-4 border-t border-border/50">
            <h4 className="text-sm font-medium mb-3">État de la connexion</h4>
            <ApiHealthCheck />
          </div>
        </div>
      </div>

      {/* Environment Variables Info */}
      <div className="glass-panel rounded-xl p-6 space-y-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Key className="w-4 h-4 text-primary" />
            Variables d'environnement
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Priorité : variables d'environnement → paramètres sauvegardés → valeurs par défaut
          </p>
        </div>

        <div className="text-xs text-muted-foreground p-3 bg-muted/30 rounded-lg border border-border/50 font-mono space-y-1">
          <div>VITE_ORDERS_API_BASE_URL={savedBaseUrl}</div>
          <div>VITE_ORDERS_API_V1_URL={savedV1Url}</div>
        </div>
      </div>

      {/* Tokens & Secrets */}
      <div className="glass-panel rounded-xl p-6 space-y-6">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Key className="w-4 h-4 text-primary" />
            Tokens & Secrets
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Gestion des clés d'authentification
          </p>
        </div>

        <div className="space-y-4">
          {/* API Token Display */}
          <div className="space-y-2">
            <Label>Token d'API Runner</Label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Input
                  type={showToken ? "text" : "password"}
                  value="••••••••••••••••••••••••••••••••"
                  readOnly
                  className="font-mono text-sm pr-10"
                />
                <button
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <Button variant="outline" size="sm" disabled>
                <RefreshCw className="w-4 h-4 mr-2" />
                Régénérer
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Utilisé par les agents pour s'authentifier • La régénération invalidera tous les agents existants
            </p>
          </div>

          <div className="text-xs text-muted-foreground p-3 bg-amber-500/5 rounded-lg border border-amber-500/10">
            <strong>Note :</strong> La gestion des tokens est automatique via le script d'installation des agents.
            La régénération manuelle sera disponible prochainement.
          </div>
        </div>
      </div>

      {/* Git Integration */}
      <div className="glass-panel rounded-xl p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-primary" />
              Intégration Git
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Connexion aux dépôts pour les déploiements
            </p>
          </div>
          <Button variant="outline" size="sm" disabled>
            Configurer
          </Button>
        </div>

        <div className="text-center py-6 text-muted-foreground border border-dashed border-border/50 rounded-lg">
          <GitBranch className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Aucune intégration Git configurée</p>
          <p className="text-xs mt-1">Les déploiements utilisent les URL de dépôt publiques</p>
        </div>
      </div>

      {/* Webhooks */}
      <div className="glass-panel rounded-xl p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <Webhook className="w-4 h-4 text-primary" />
              Webhooks
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Recevez des notifications sur des événements système
            </p>
          </div>
          <Button variant="outline" size="sm" disabled>
            Ajouter
          </Button>
        </div>

        <div className="text-center py-6 text-muted-foreground border border-dashed border-border/50 rounded-lg">
          <Webhook className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Aucun webhook configuré</p>
          <p className="text-xs mt-1">Bientôt disponible</p>
        </div>
      </div>
    </div>
  );
}
