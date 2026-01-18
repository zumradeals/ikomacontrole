import { useState } from 'react';
import { Server, Loader2 } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { ProxyRunner } from '@/hooks/useApiServers';

interface ServerFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  runners: ProxyRunner[];
  onSubmit: (data: { name: string; baseUrl?: string; runnerId?: string | null }) => Promise<void>;
  isLoading?: boolean;
}

export function ServerForm({
  open,
  onOpenChange,
  runners,
  onSubmit,
  isLoading,
}: ServerFormProps) {
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [selectedRunner, setSelectedRunner] = useState<string>('__none__');

  // Sort runners: ONLINE first
  const sortedRunners = [...runners].sort((a, b) => {
    if (a.status === 'ONLINE' && b.status !== 'ONLINE') return -1;
    if (a.status !== 'ONLINE' && b.status === 'ONLINE') return 1;
    return a.name.localeCompare(b.name);
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    await onSubmit({
      name: name.trim(),
      baseUrl: baseUrl.trim() || undefined,
      runnerId: selectedRunner === '__none__' ? null : selectedRunner,
    });

    // Reset form
    setName('');
    setBaseUrl('');
    setSelectedRunner('__none__');
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setName('');
      setBaseUrl('');
      setSelectedRunner('__none__');
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Server className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Créer un serveur</DialogTitle>
              <DialogDescription>
                Ajoutez un serveur via l'API Orders
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nom du serveur *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="prod-server-01"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="baseUrl">URL de base (optionnel)</Label>
            <Input
              id="baseUrl"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://server.example.com"
              type="url"
            />
          </div>

          <div className="space-y-2">
            <Label>Runner à associer (optionnel)</Label>
            <Select value={selectedRunner} onValueChange={setSelectedRunner}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un runner..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">
                  <span className="text-muted-foreground">Aucun</span>
                </SelectItem>
                {sortedRunners.map((runner) => (
                  <SelectItem key={runner.id} value={runner.id}>
                    <div className="flex items-center gap-2">
                      <span 
                        className={cn(
                          'w-2 h-2 rounded-full',
                          runner.status === 'ONLINE' ? 'bg-emerald-500' : 'bg-muted-foreground'
                        )} 
                      />
                      <span>{runner.name}</span>
                      <span className="text-xs text-muted-foreground">({runner.status})</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Vous pourrez associer un runner ultérieurement.
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
                  Création...
                </>
              ) : (
                'Créer'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
