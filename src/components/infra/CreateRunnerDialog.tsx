/**
 * Create Runner Dialog
 * 
 * Dialog for creating a new runner and optionally attaching it to a server.
 * Shows the token only once after creation.
 */

import { useState } from 'react';
import { Plus, Copy, Check, AlertTriangle, Server } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/hooks/use-toast';
import { useCreateAndAttachRunner, type CreateRunnerResult } from '@/hooks/useProxyServers';
import { buildInstallCommand } from '@/lib/api-client';

interface CreateRunnerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serverId: string;
  serverName: string;
}

export function CreateRunnerDialog({ 
  open, 
  onOpenChange, 
  serverId, 
  serverName 
}: CreateRunnerDialogProps) {
  const [name, setName] = useState('');
  const [createdRunner, setCreatedRunner] = useState<CreateRunnerResult | null>(null);
  const [copied, setCopied] = useState(false);
  
  const createMutation = useCreateAndAttachRunner();

  const handleCreate = async () => {
    if (!name.trim()) {
      toast({
        title: 'Nom requis',
        description: 'Entrez un nom pour l\'agent.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const result = await createMutation.mutateAsync({
        name: name.trim(),
        serverId,
      });
      
      setCreatedRunner(result.runner);
      setName('');
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleCopyToken = () => {
    if (createdRunner?.token) {
      navigator.clipboard.writeText(createdRunner.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: 'Token copié',
        description: 'Le token a été copié dans le presse-papier.',
      });
    }
  };

  const handleCopyCommand = () => {
    if (createdRunner?.token) {
      const command = buildInstallCommand(createdRunner.token);
      navigator.clipboard.writeText(command);
      toast({
        title: 'Commande copiée',
        description: 'La commande d\'installation a été copiée.',
      });
    }
  };

  const handleClose = () => {
    setCreatedRunner(null);
    setName('');
    setCopied(false);
    onOpenChange(false);
  };

  // Show token confirmation screen after creation
  if (createdRunner) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-500">
              <Check className="w-5 h-5" />
              Agent créé : {createdRunner.name}
            </DialogTitle>
            <DialogDescription>
              Copiez le token maintenant. Il ne sera plus jamais visible.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Alert className="border-amber-500/50 bg-amber-500/10">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <AlertDescription className="text-amber-200">
                <strong>Important :</strong> Ce token ne sera affiché qu'une seule fois.
                Copiez-le maintenant et conservez-le en lieu sûr.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label>Token d'authentification</Label>
              <div className="flex gap-2">
                <Input 
                  value={createdRunner.token} 
                  readOnly 
                  className="font-mono text-sm"
                />
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={handleCopyToken}
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Commande d'installation</Label>
              <div className="p-3 rounded-lg bg-muted/50 font-mono text-xs break-all">
                {buildInstallCommand(createdRunner.token)}
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleCopyCommand}
                className="w-full"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copier la commande
              </Button>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Server className="w-4 h-4" />
              <span>Associé à : <strong>{serverName}</strong></span>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={handleClose}>
              J'ai copié le token
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Show creation form
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Créer un agent pour {serverName}</DialogTitle>
          <DialogDescription>
            L'agent sera créé et automatiquement associé à ce serveur.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="runner-name">Nom de l'agent</Label>
            <Input
              id="runner-name"
              placeholder="Mon Agent"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !createMutation.isPending) {
                  handleCreate();
                }
              }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Annuler
          </Button>
          <Button 
            onClick={handleCreate}
            disabled={createMutation.isPending || !name.trim()}
          >
            <Plus className="w-4 h-4 mr-2" />
            {createMutation.isPending ? 'Création...' : 'Créer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
