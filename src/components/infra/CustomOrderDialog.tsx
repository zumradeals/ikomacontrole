import { useState } from 'react';
import { Terminal, AlertTriangle, Play, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateOrder } from '@/hooks/useOrders';
import { toast } from 'sonner';
import { z } from 'zod';

interface Runner {
  id: string;
  name: string;
  status: string;
}

interface CustomOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  runner: Runner;
  infrastructureId: string;
}

// Validation schema
const customOrderSchema = z.object({
  name: z.string()
    .trim()
    .min(1, "Le nom est requis")
    .max(100, "Le nom doit faire moins de 100 caractères"),
  description: z.string()
    .trim()
    .max(500, "La description doit faire moins de 500 caractères")
    .optional(),
  command: z.string()
    .trim()
    .min(1, "La commande est requise")
    .max(10000, "La commande doit faire moins de 10000 caractères"),
  category: z.enum(['maintenance', 'installation', 'update', 'security']),
});

type CustomOrderInput = z.infer<typeof customOrderSchema>;

const COMMAND_TEMPLATES = [
  { label: 'Aucun (commande libre)', value: '' },
  { label: 'Vérifier l\'espace disque', value: 'df -h' },
  { label: 'Lister les processus', value: 'ps aux --sort=-%mem | head -20' },
  { label: 'Vérifier la mémoire', value: 'free -h' },
  { label: 'Uptime système', value: 'uptime' },
  { label: 'Liste des services actifs', value: 'systemctl list-units --type=service --state=running' },
  { label: 'Vérifier les ports ouverts', value: 'ss -tulpn' },
  { label: 'Logs système récents', value: 'journalctl -n 50 --no-pager' },
  { label: 'Infos réseau', value: 'ip addr show' },
  { label: 'Version du noyau', value: 'uname -a' },
];

export function CustomOrderDialog({ open, onOpenChange, runner, infrastructureId }: CustomOrderDialogProps) {
  const createOrder = useCreateOrder();
  const [formData, setFormData] = useState<CustomOrderInput>({
    name: '',
    description: '',
    command: '',
    category: 'maintenance',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedTemplate, setSelectedTemplate] = useState('');

  const handleTemplateChange = (value: string) => {
    setSelectedTemplate(value);
    if (value) {
      const template = COMMAND_TEMPLATES.find(t => t.value === value);
      if (template) {
        setFormData(prev => ({
          ...prev,
          command: value,
          name: prev.name || template.label,
        }));
      }
    }
  };

  const validateForm = (): boolean => {
    try {
      customOrderSchema.parse(formData);
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach(err => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    if (runner.status !== 'online') {
      toast.warning('Le runner est hors ligne', {
        description: 'La commande sera exécutée dès que le runner sera de nouveau en ligne.',
      });
    }

    try {
      await createOrder.mutateAsync({
        name: formData.name.trim(),
        description: formData.description?.trim() || `Commande personnalisée: ${formData.command.substring(0, 50)}...`,
        command: formData.command.trim(),
        category: formData.category,
        runner_id: runner.id,
        infrastructure_id: infrastructureId,
      });

      toast.success('Commande envoyée', {
        description: `La commande "${formData.name}" a été envoyée au runner ${runner.name}`,
      });

      // Reset form
      setFormData({
        name: '',
        description: '',
        command: '',
        category: 'maintenance',
      });
      setSelectedTemplate('');
      onOpenChange(false);
    } catch (error) {
      toast.error('Erreur', {
        description: 'Impossible d\'envoyer la commande',
      });
    }
  };

  const isRunnerOffline = runner.status !== 'online';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Terminal className="w-5 h-5" />
            Commande personnalisée
          </DialogTitle>
          <DialogDescription>
            Envoyez une commande shell personnalisée au runner <strong>{runner.name}</strong>
          </DialogDescription>
        </DialogHeader>

        {isRunnerOffline && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <p className="text-sm">
              Le runner est actuellement hors ligne. La commande sera mise en file d'attente.
            </p>
          </div>
        )}

        <div className="space-y-4">
          {/* Template selector */}
          <div className="space-y-2">
            <Label>Modèle de commande</Label>
            <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir un modèle (optionnel)" />
              </SelectTrigger>
              <SelectContent>
                {COMMAND_TEMPLATES.map(template => (
                  <SelectItem key={template.value || 'none'} value={template.value || 'none'}>
                    {template.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="order-name">Nom de la commande *</Label>
            <Input
              id="order-name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Ex: Vérification espace disque"
              maxLength={100}
              className={errors.name ? 'border-red-500' : ''}
            />
            {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>Catégorie</Label>
            <Select 
              value={formData.category} 
              onValueChange={(value) => setFormData(prev => ({ 
                ...prev, 
                category: value as CustomOrderInput['category']
              }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="installation">Installation</SelectItem>
                <SelectItem value="update">Mise à jour</SelectItem>
                <SelectItem value="security">Sécurité</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="order-description">Description (optionnel)</Label>
            <Input
              id="order-description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Décrivez l'objectif de cette commande"
              maxLength={500}
            />
          </div>

          {/* Command */}
          <div className="space-y-2">
            <Label htmlFor="order-command">Commande shell *</Label>
            <Textarea
              id="order-command"
              value={formData.command}
              onChange={(e) => setFormData(prev => ({ ...prev, command: e.target.value }))}
              placeholder="Ex: df -h && free -m"
              className={`font-mono text-sm min-h-32 ${errors.command ? 'border-red-500' : ''}`}
              maxLength={10000}
            />
            {errors.command && <p className="text-xs text-red-500">{errors.command}</p>}
            <p className="text-xs text-muted-foreground">
              {formData.command.length}/10000 caractères
            </p>
          </div>

          {/* Security warning */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border/50">
            <Info className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground">
              <p className="font-medium mb-1">Conseils de sécurité :</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Évitez les commandes destructives (rm -rf, etc.)</li>
                <li>Testez d'abord sur un environnement de développement</li>
                <li>Les commandes sont exécutées avec les privilèges du service runner</li>
              </ul>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={createOrder.isPending || !formData.name || !formData.command}
          >
            {createOrder.isPending ? (
              'Envoi...'
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Exécuter
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
