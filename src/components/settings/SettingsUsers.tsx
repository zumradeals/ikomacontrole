import { Users, Shield, Crown, Eye, UserCog, Clock, X, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useUserRoles, type AppRole } from '@/hooks/useUserRoles';
import { InviteUserDialog } from './InviteUserDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

const roleConfig: Record<AppRole, { label: string; icon: any; color: string }> = {
  admin: { label: 'Administrateur', icon: Crown, color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  operator: { label: 'Opérateur', icon: UserCog, color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  viewer: { label: 'Observateur', icon: Eye, color: 'bg-muted text-muted-foreground border-border' },
};

export function SettingsUsers() {
  const { user } = useAuth();
  const { 
    userRoles, 
    invitations, 
    isLoading, 
    isAdmin, 
    currentUserRole,
    cancelInvitation,
    updateUserRole,
    removeUser,
  } = useUserRoles();

  const pendingInvitations = invitations?.filter(i => i.status === 'pending') || [];

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      await cancelInvitation.mutateAsync(invitationId);
      toast.success('Invitation annulée');
    } catch (error) {
      toast.error('Erreur lors de l\'annulation');
    }
  };

  const handleUpdateRole = async (userId: string, newRole: AppRole) => {
    try {
      await updateUserRole.mutateAsync({ userId, role: newRole });
      toast.success('Rôle mis à jour');
    } catch (error) {
      toast.error('Erreur lors de la mise à jour du rôle');
    }
  };

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
          <InviteUserDialog />
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
            <Badge variant="outline" className={roleConfig[currentUserRole].color}>
              {(() => {
                const Icon = roleConfig[currentUserRole].icon;
                return <Icon className="w-3 h-3 mr-1" />;
              })()}
              {roleConfig[currentUserRole].label}
            </Badge>
          </div>

          {/* Other Users */}
          {userRoles?.filter(r => r.user_id !== user?.id).map((userRole) => (
            <div key={userRole.id} className="flex items-center justify-between p-4 rounded-lg border border-border/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <span className="text-sm font-semibold text-muted-foreground">
                    ?
                  </span>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">{userRole.user_id.slice(0, 8)}...</p>
                  <p className="text-xs text-muted-foreground">
                    Ajouté {formatDistanceToNow(new Date(userRole.created_at), { addSuffix: true, locale: fr })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={roleConfig[userRole.role].color}>
                  {(() => {
                    const Icon = roleConfig[userRole.role].icon;
                    return <Icon className="w-3 h-3 mr-1" />;
                  })()}
                  {roleConfig[userRole.role].label}
                </Badge>
                {isAdmin && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleUpdateRole(userRole.user_id, 'admin')}>
                        <Crown className="w-4 h-4 mr-2" />
                        Définir Administrateur
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleUpdateRole(userRole.user_id, 'operator')}>
                        <UserCog className="w-4 h-4 mr-2" />
                        Définir Opérateur
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleUpdateRole(userRole.user_id, 'viewer')}>
                        <Eye className="w-4 h-4 mr-2" />
                        Définir Observateur
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        className="text-destructive"
                        onClick={() => removeUser.mutateAsync(userRole.user_id)}
                      >
                        <X className="w-4 h-4 mr-2" />
                        Retirer l'accès
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          ))}

          {(!userRoles || userRoles.length <= 1) && (
            <div className="text-center py-6 text-muted-foreground border border-dashed border-border/50 rounded-lg">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Aucun autre utilisateur</p>
              <p className="text-xs mt-1">Invitez des collaborateurs pour travailler ensemble</p>
            </div>
          )}
        </div>
      </div>

      {/* Pending Invitations */}
      {pendingInvitations.length > 0 && (
        <div className="glass-panel rounded-xl p-6 space-y-6">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              Invitations en attente
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Ces utilisateurs n'ont pas encore créé leur compte
            </p>
          </div>

          <div className="space-y-2">
            {pendingInvitations.map((invitation) => (
              <div key={invitation.id} className="flex items-center justify-between p-4 rounded-lg border border-dashed border-amber-500/30 bg-amber-500/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <p className="font-medium">{invitation.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Invité {formatDistanceToNow(new Date(invitation.created_at), { addSuffix: true, locale: fr })} • 
                      Expire {formatDistanceToNow(new Date(invitation.expires_at), { addSuffix: true, locale: fr })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={roleConfig[invitation.role].color}>
                    {roleConfig[invitation.role].label}
                  </Badge>
                  {isAdmin && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleCancelInvitation(invitation.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
          <strong>Note :</strong> Les rôles sont automatiquement appliqués lors de la création du compte.
          Le premier utilisateur inscrit devient automatiquement administrateur.
        </div>
      </div>
    </div>
  );
}
