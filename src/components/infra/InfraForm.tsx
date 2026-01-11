import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Infrastructure, InfrastructureInput } from '@/hooks/useInfrastructures';
import { useState } from 'react';

const infraSchema = z.object({
  name: z.string().min(1, 'Le nom est requis').max(100),
  type: z.enum(['vps', 'bare_metal', 'cloud']),
  os: z.string().max(50).optional().nullable(),
  distribution: z.string().max(100).optional().nullable(),
  architecture: z.string().max(20).optional().nullable(),
  cpu_cores: z.coerce.number().int().positive().optional().nullable(),
  ram_gb: z.coerce.number().positive().optional().nullable(),
  disk_gb: z.coerce.number().positive().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  capabilities: z.string().optional(),
});

type InfraFormValues = z.infer<typeof infraSchema>;

interface InfraFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  infrastructure?: Infrastructure | null;
  onSubmit: (data: InfrastructureInput) => Promise<void>;
  isLoading?: boolean;
}

export function InfraForm({ open, onOpenChange, infrastructure, onSubmit, isLoading }: InfraFormProps) {
  const [expertMode, setExpertMode] = useState(false);
  const isEditing = !!infrastructure;

  const form = useForm<InfraFormValues>({
    resolver: zodResolver(infraSchema),
    defaultValues: {
      name: '',
      type: 'vps',
      os: '',
      distribution: '',
      architecture: '',
      cpu_cores: undefined,
      ram_gb: undefined,
      disk_gb: undefined,
      notes: '',
      capabilities: '{}',
    },
  });

  useEffect(() => {
    if (infrastructure) {
      form.reset({
        name: infrastructure.name,
        type: infrastructure.type,
        os: infrastructure.os || '',
        distribution: infrastructure.distribution || '',
        architecture: infrastructure.architecture || '',
        cpu_cores: infrastructure.cpu_cores || undefined,
        ram_gb: infrastructure.ram_gb || undefined,
        disk_gb: infrastructure.disk_gb || undefined,
        notes: infrastructure.notes || '',
        capabilities: JSON.stringify(infrastructure.capabilities || {}, null, 2),
      });
    } else {
      form.reset({
        name: '',
        type: 'vps',
        os: '',
        distribution: '',
        architecture: '',
        cpu_cores: undefined,
        ram_gb: undefined,
        disk_gb: undefined,
        notes: '',
        capabilities: '{}',
      });
    }
  }, [infrastructure, form]);

  const handleSubmit = async (values: InfraFormValues) => {
    let capabilities = {};
    if (values.capabilities) {
      try {
        capabilities = JSON.parse(values.capabilities);
      } catch {
        form.setError('capabilities', { message: 'JSON invalide' });
        return;
      }
    }

    const data: InfrastructureInput = {
      name: values.name,
      type: values.type,
      os: values.os || null,
      distribution: values.distribution || null,
      architecture: values.architecture || null,
      cpu_cores: values.cpu_cores || null,
      ram_gb: values.ram_gb || null,
      disk_gb: values.disk_gb || null,
      notes: values.notes || null,
      capabilities,
    };

    await onSubmit(data);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Modifier l\'infrastructure' : 'Déclarer une infrastructure'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom *</FormLabel>
                  <FormControl>
                    <Input placeholder="VPS Production" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Type */}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="vps">VPS</SelectItem>
                      <SelectItem value="bare_metal">Bare Metal</SelectItem>
                      <SelectItem value="cloud">Cloud</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              {/* OS */}
              <FormField
                control={form.control}
                name="os"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>OS</FormLabel>
                    <FormControl>
                      <Input placeholder="Linux" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Architecture */}
              <FormField
                control={form.control}
                name="architecture"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Architecture</FormLabel>
                    <FormControl>
                      <Input placeholder="x86_64" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Distribution */}
            <FormField
              control={form.control}
              name="distribution"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Distribution</FormLabel>
                  <FormControl>
                    <Input placeholder="Ubuntu 22.04" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-4">
              {/* CPU Cores */}
              <FormField
                control={form.control}
                name="cpu_cores"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CPU Cores</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="4" 
                        {...field} 
                        value={field.value ?? ''} 
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* RAM */}
              <FormField
                control={form.control}
                name="ram_gb"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>RAM (GB)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="8" 
                        {...field} 
                        value={field.value ?? ''} 
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Disk */}
              <FormField
                control={form.control}
                name="disk_gb"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Disk (GB)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="100" 
                        {...field} 
                        value={field.value ?? ''} 
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Notes additionnelles..." 
                      className="resize-none" 
                      rows={2}
                      {...field} 
                      value={field.value || ''} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Expert Mode Toggle */}
            <div className="flex items-center space-x-2 pt-2">
              <Switch
                id="expert-mode"
                checked={expertMode}
                onCheckedChange={setExpertMode}
              />
              <Label htmlFor="expert-mode">Mode Expert</Label>
            </div>

            {/* Capabilities (Expert Mode) */}
            {expertMode && (
              <FormField
                control={form.control}
                name="capabilities"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Capabilities (JSON)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder='{"feature": true}'
                        className="font-mono text-sm resize-none"
                        rows={4}
                        {...field}
                        value={field.value || '{}'}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Enregistrement...' : isEditing ? 'Mettre à jour' : 'Créer'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
