import { useState, useEffect } from 'react';
import { Pencil, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ProxyServer } from '@/hooks/useApiServers';

interface ServerEditFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  server: ProxyServer | null;
  onSubmit: (data: { name: string; host?: string }) => Promise<void>;
  isLoading?: boolean;
}

export function ServerEditForm({
  open,
  onOpenChange,
  server,
  onSubmit,
  isLoading,
}: ServerEditFormProps) {
  const [name, setName] = useState('');
  const [host, setHost] = useState('');

  useEffect(() => {
    if (server) {
      setName(server.name || '');
      setHost(server.host || '');
    }
  }, [server]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    await onSubmit({
      name: name.trim(),
      host: host.trim() || undefined,
    });
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setName('');
      setHost('');
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Pencil className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Modifier le serveur</DialogTitle>
              <DialogDescription>
                Modifiez les informations du serveur
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Nom du serveur *</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="prod-server-01"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-host">URL / Hôte</Label>
            <Input
              id="edit-host"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="https://server.example.com"
            />
            <p className="text-xs text-muted-foreground">
              L'adresse IP ou le nom de domaine du serveur
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isLoading}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={isLoading || !name.trim()}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                'Enregistrer'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
