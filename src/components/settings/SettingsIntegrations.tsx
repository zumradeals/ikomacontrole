import { Link2, Save, Key, GitBranch, Webhook, RefreshCw, Eye, EyeOff, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSettingInput } from '@/hooks/useSettings';
import { ApiHealthCheck } from '@/components/runner/ApiHealthCheck';
import { toast } from 'sonner';
import { useState } from 'react';

export function SettingsIntegrations() {
  const { 
    value: runnerBaseUrl, 
    onChange: setRunnerBaseUrl, 
    onSave: saveRunnerBaseUrl,
    isUpdating,
    isDirty 
  } = useSettingInput('runner_base_url');

  const [showToken, setShowToken] = useState(false);

  const handleSave = async () => {
    try {
      await saveRunnerBaseUrl();
      toast.success('Configuration sauvegardée');
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde');
    }
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(runnerBaseUrl);
    toast.success('URL copiée');
  };

  return (
    <div className="space-y-6">
      {/* Runner API */}
      <div className="glass-panel rounded-xl p-6 space-y-6">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Link2 className="w-4 h-4 text-primary" />
            API des Agents (Runner)
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Configuration de la connexion entre les agents et le Control Plane
          </p>
        </div>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="runner_base_url">URL de base de l'API</Label>
            <div className="flex gap-2">
              <Input
                id="runner_base_url"
                placeholder="https://example.supabase.co/functions/v1/runner-api"
                value={runnerBaseUrl}
                onChange={(e) => setRunnerBaseUrl(e.target.value)}
              />
              <Button 
                variant="ghost" 
                size="icon"
                onClick={handleCopyUrl}
                disabled={!runnerBaseUrl}
              >
                <Copy className="w-4 h-4" />
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={!isDirty || isUpdating}
                variant={isDirty ? "default" : "outline"}
              >
                <Save className="w-4 h-4 mr-2" />
                {isUpdating ? 'Sauvegarde...' : 'Sauvegarder'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              URL publique où les agents peuvent contacter l'API du Control Plane
            </p>
          </div>

          {/* API Health */}
          <div className="pt-4 border-t border-border/50">
            <h4 className="text-sm font-medium mb-3">État de la connexion</h4>
            <ApiHealthCheck baseUrl={runnerBaseUrl} />
          </div>
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
