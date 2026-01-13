import { Shield, Clock, FileText, AlertTriangle, Lock, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useAppMode } from '@/contexts/AppModeContext';

export function SettingsSecurity() {
  const { isExpert } = useAppMode();

  return (
    <div className="space-y-6">
      {/* Session Policy */}
      <div className="glass-panel rounded-xl p-6 space-y-6">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Politique de Sessions
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Gérez la durée et la sécurité des sessions utilisateur
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="session_timeout">Expiration de session (heures)</Label>
            <Input
              id="session_timeout"
              type="number"
              defaultValue={24}
              disabled
            />
            <p className="text-xs text-muted-foreground">
              Durée avant déconnexion automatique
            </p>
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border/50">
            <div className="space-y-1">
              <Label className="font-medium">Forcer la reconnexion</Label>
              <p className="text-xs text-muted-foreground">
                Exiger une nouvelle connexion après changement de mot de passe
              </p>
            </div>
            <Switch disabled checked={true} />
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border/50">
            <div className="space-y-1">
              <Label className="font-medium">Session unique</Label>
              <p className="text-xs text-muted-foreground">
                Déconnecter les autres sessions lors d'une nouvelle connexion
              </p>
            </div>
            <Switch disabled checked={false} />
          </div>
        </div>
      </div>

      {/* Audit Log */}
      <div className="glass-panel rounded-xl p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Journal d'Audit
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Suivi des actions administratives
            </p>
          </div>
          <Link to="/observability">
            <Button variant="outline" size="sm">
              <ExternalLink className="w-4 h-4 mr-2" />
              Voir l'activité
            </Button>
          </Link>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/30">
            <span className="text-sm">Événements enregistrés (24h)</span>
            <span className="font-mono text-sm">-</span>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/30">
            <span className="text-sm">Dernière action admin</span>
            <span className="font-mono text-sm text-muted-foreground">-</span>
          </div>
        </div>

        <div className="text-xs text-muted-foreground p-3 bg-primary/5 rounded-lg border border-primary/10">
          L'historique complet des actions est disponible dans la section Observabilité → Historique.
        </div>
      </div>

      {/* Access Control */}
      <div className="glass-panel rounded-xl p-6 space-y-6">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Lock className="w-4 h-4 text-primary" />
            Contrôle d'Accès
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Restrictions et sécurité avancée
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border/50">
            <div className="space-y-1">
              <Label className="font-medium">Mode maintenance</Label>
              <p className="text-xs text-muted-foreground">
                Restreindre l'accès aux administrateurs uniquement
              </p>
            </div>
            <Switch disabled checked={false} />
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border/50">
            <div className="space-y-1">
              <Label className="font-medium">IP Whitelist</Label>
              <p className="text-xs text-muted-foreground">
                Limiter les connexions à des adresses IP spécifiques
              </p>
            </div>
            <Switch disabled checked={false} />
          </div>
        </div>
      </div>

      {/* Security Warning */}
      {isExpert && (
        <div className="glass-panel rounded-xl p-6 border-amber-500/30 bg-amber-500/5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-amber-400">Mode Expert Activé</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Le mode expert donne accès à des fonctionnalités avancées qui peuvent impacter la stabilité 
                du système si mal configurées. Assurez-vous de comprendre les implications avant de modifier 
                les paramètres de déploiement et de routage.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
