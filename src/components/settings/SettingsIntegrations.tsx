import { Link2, Key, GitBranch, Webhook, RefreshCw, Eye, EyeOff, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiHealthCheck } from '@/components/runner/ApiHealthCheck';
import { ORDERS_API_BASE_URL, ORDERS_API_FULL_URL } from '@/lib/api-client';
import { toast } from 'sonner';
import { useState } from 'react';

export function SettingsIntegrations() {
  const [showToken, setShowToken] = useState(false);

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(ORDERS_API_FULL_URL);
    toast.success('URL copiée');
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
            Connexion à l'API externe de gestion des ordres
          </p>
        </div>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>URL de base de l'API</Label>
            <div className="flex gap-2">
              <Input
                value={ORDERS_API_BASE_URL}
                readOnly
                className="font-mono text-sm bg-muted/50"
              />
              <Button 
                variant="ghost" 
                size="icon"
                onClick={handleCopyUrl}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              API endpoints: <code className="text-primary">/v1/*</code> • Health: <code className="text-primary">/health</code>
            </p>
          </div>

          {/* API Health */}
          <div className="pt-4 border-t border-border/50">
            <h4 className="text-sm font-medium mb-3">État de la connexion</h4>
            <ApiHealthCheck />
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
