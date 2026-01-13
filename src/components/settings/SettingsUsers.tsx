import { Users, Shield, Crown, Eye, UserCog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';

// Placeholder data - in a real app, this would come from a users table
const mockUsers = [
  { id: '1', email: 'admin@ikoma.io', role: 'admin', lastSeen: new Date() },
];

const roleConfig = {
  admin: { label: 'Administrateur', icon: Crown, color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  operator: { label: 'Opérateur', icon: UserCog, color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  viewer: { label: 'Observateur', icon: Eye, color: 'bg-muted text-muted-foreground border-border' },
};

export function SettingsUsers() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      {/* Users List */}
      <div className="glass-panel rounded-xl p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Utilisateurs
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Gérez les accès au Control Plane
            </p>
          </div>
          <Button variant="outline" size="sm" disabled>
            Inviter un utilisateur
          </Button>
        </div>

        <div className="space-y-2">
          {/* Current User */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-sm font-semibold text-primary">
                  {user?.email?.[0].toUpperCase() || 'U'}
                </span>
              </div>
              <div>
                <p className="font-medium">{user?.email}</p>
                <p className="text-xs text-muted-foreground">Connecté maintenant • Vous</p>
              </div>
            </div>
            <Badge variant="outline" className={roleConfig.admin.color}>
              <Crown className="w-3 h-3 mr-1" />
              {roleConfig.admin.label}
            </Badge>
          </div>

          {/* Placeholder for more users */}
          <div className="text-center py-8 text-muted-foreground border border-dashed border-border/50 rounded-lg">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Gestion multi-utilisateurs</p>
            <p className="text-xs mt-1">Bientôt disponible</p>
          </div>
        </div>
      </div>

      {/* Roles & Permissions */}
      <div className="glass-panel rounded-xl p-6 space-y-6">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            Rôles et Permissions
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Définissez les niveaux d'accès
          </p>
        </div>

        <div className="space-y-3">
          {Object.entries(roleConfig).map(([key, config]) => {
            const Icon = config.icon;
            return (
              <div 
                key={key}
                className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-muted/20"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${config.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-medium">{config.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {key === 'admin' && 'Accès complet : configuration, utilisateurs, tous les modules'}
                      {key === 'operator' && 'Gestion opérationnelle : serveurs, agents, déploiements'}
                      {key === 'viewer' && 'Lecture seule : dashboard, observabilité'}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-xs text-muted-foreground p-3 bg-amber-500/5 rounded-lg border border-amber-500/10">
          <strong>Note :</strong> Le système de rôles granulaires est en cours de développement. 
          Actuellement, tous les utilisateurs authentifiés ont un accès administrateur.
        </div>
      </div>
    </div>
  );
}
