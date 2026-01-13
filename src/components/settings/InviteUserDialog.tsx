import { useState } from 'react';
import { UserPlus, Mail, Shield } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUserRoles, type AppRole } from '@/hooks/useUserRoles';
import { toast } from 'sonner';

const roleLabels: Record<AppRole, string> = {
  admin: 'Administrateur',
  operator: 'Opérateur',
  viewer: 'Observateur',
};

const roleDescriptions: Record<AppRole, string> = {
  admin: 'Accès complet : configuration, utilisateurs, tous les modules',
  operator: 'Gestion opérationnelle : serveurs, agents, déploiements',
  viewer: 'Lecture seule : dashboard, observabilité',
};

export function InviteUserDialog() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AppRole>('viewer');
  const { createInvitation, isAdmin } = useUserRoles();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      toast.error('Veuillez saisir une adresse email');
      return;
    }

    try {
      await createInvitation.mutateAsync({ email: email.trim(), role });
      toast.success(`Invitation envoyée à ${email}`);
      setEmail('');
      setRole('viewer');
      setOpen(false);
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de l\'envoi de l\'invitation');
    }
  };

  if (!isAdmin) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserPlus className="w-4 h-4 mr-2" />
          Inviter un utilisateur
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            Inviter un utilisateur
          </DialogTitle>
          <DialogDescription>
            L'utilisateur recevra un email pour créer son compte et sera automatiquement assigné au rôle choisi.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Adresse email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="utilisateur@exemple.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Rôle</Label>
            <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(['viewer', 'operator', 'admin'] as AppRole[]).map((r) => (
                  <SelectItem key={r} value={r}>
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      <span>{roleLabels[r]}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {roleDescriptions[role]}
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={createInvitation.isPending}>
              {createInvitation.isPending ? 'Envoi...' : 'Envoyer l\'invitation'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
