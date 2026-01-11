import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Server, HardDrive, Cloud, Info } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Infrastructure, InfrastructureInput } from '@/hooks/useInfrastructures';

// Capability options with tri-state: installed, not_installed, unknown
type CapabilityStatus = 'installed' | 'not_installed' | 'unknown';

interface CapabilityDefinition {
  key: string;
  label: string;
  description: string;
}

const CAPABILITIES: CapabilityDefinition[] = [
  { key: 'docker', label: 'Docker', description: 'Container runtime' },
  { key: 'docker_compose', label: 'Docker Compose', description: 'Multi-container' },
  { key: 'git', label: 'Git', description: 'Version control' },
  { key: 'root_access', label: 'Accès root', description: 'Privilèges admin' },
  { key: 'exposable_ports', label: 'Ports exposables', description: 'Firewall ouvert' },
  { key: 'https_possible', label: 'HTTPS possible', description: 'SSL/TLS' },
  { key: 'internet_access', label: 'Accès Internet sortant', description: 'Downloads, APIs' },
];

const OS_OPTIONS = ['Linux', 'Windows', 'macOS', 'FreeBSD'];
const ARCH_OPTIONS = [
  { value: 'x86_64', label: 'x86_64 (AMD64)' },
  { value: 'arm64', label: 'ARM64 (AArch64)' },
  { value: 'armv7', label: 'ARMv7' },
  { value: 'i386', label: 'i386 (32-bit)' },
];

const infraSchema = z.object({
  name: z.string().min(1, 'Le nom est requis').max(100),
  type: z.enum(['vps', 'bare_metal', 'cloud']),
  notes: z.string().max(1000).optional().nullable(),
  os: z.string().max(50).optional().nullable(),
  distribution: z.string().max(100).optional().nullable(),
  architecture: z.string().max(20).optional().nullable(),
  cpu_cores: z.coerce.number().int().positive().optional().nullable(),
  ram_gb: z.coerce.number().positive().optional().nullable(),
  disk_gb: z.coerce.number().positive().optional().nullable(),
  provider: z.string().max(100).optional().nullable(),
  location: z.string().max(100).optional().nullable(),
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
  const isEditing = !!infrastructure;
  
  // Capabilities state
  const [capabilities, setCapabilities] = useState<Record<string, CapabilityStatus>>(() => {
    const initial: Record<string, CapabilityStatus> = {};
    CAPABILITIES.forEach(cap => {
      initial[cap.key] = 'unknown';
    });
    return initial;
  });

  const form = useForm<InfraFormValues>({
    resolver: zodResolver(infraSchema),
    defaultValues: {
      name: '',
      type: 'vps',
      notes: '',
      os: '',
      distribution: '',
      architecture: '',
      cpu_cores: undefined,
      ram_gb: undefined,
      disk_gb: undefined,
      provider: '',
      location: '',
    },
  });

  useEffect(() => {
    if (infrastructure) {
      const caps = infrastructure.capabilities as Record<string, unknown> || {};
      form.reset({
        name: infrastructure.name,
        type: infrastructure.type,
        notes: infrastructure.notes || '',
        os: infrastructure.os || '',
        distribution: infrastructure.distribution || '',
        architecture: infrastructure.architecture || '',
        cpu_cores: infrastructure.cpu_cores || undefined,
        ram_gb: infrastructure.ram_gb || undefined,
        disk_gb: infrastructure.disk_gb || undefined,
        provider: (caps.provider as string) || '',
        location: (caps.location as string) || '',
      });
      
      // Set capabilities from infrastructure
      const newCaps: Record<string, CapabilityStatus> = {};
      CAPABILITIES.forEach(cap => {
        const value = caps[cap.key];
        if (value === true || value === 'installed') {
          newCaps[cap.key] = 'installed';
        } else if (value === false || value === 'not_installed') {
          newCaps[cap.key] = 'not_installed';
        } else {
          newCaps[cap.key] = 'unknown';
        }
      });
      setCapabilities(newCaps);
    } else {
      form.reset({
        name: '',
        type: 'vps',
        notes: '',
        os: '',
        distribution: '',
        architecture: '',
        cpu_cores: undefined,
        ram_gb: undefined,
        disk_gb: undefined,
        provider: '',
        location: '',
      });
      const initial: Record<string, CapabilityStatus> = {};
      CAPABILITIES.forEach(cap => {
        initial[cap.key] = 'unknown';
      });
      setCapabilities(initial);
    }
  }, [infrastructure, form, open]);

  const handleSubmit = async (values: InfraFormValues) => {
    // Build capabilities object
    const capsObject: Record<string, unknown> = {};
    CAPABILITIES.forEach(cap => {
      const status = capabilities[cap.key];
      if (status === 'installed') {
        capsObject[cap.key] = true;
      } else if (status === 'not_installed') {
        capsObject[cap.key] = false;
      }
      // 'unknown' is not stored
    });
    
    // Add provider and location to capabilities
    if (values.provider) {
      capsObject.provider = values.provider;
    }
    if (values.location) {
      capsObject.location = values.location;
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
      capabilities: capsObject,
    };

    await onSubmit(data);
    onOpenChange(false);
  };

  const typeIcons = {
    vps: Server,
    bare_metal: HardDrive,
    cloud: Cloud,
  };

  const getCapabilityLabel = (status: CapabilityStatus) => {
    switch (status) {
      case 'installed': return 'Installé';
      case 'not_installed': return 'Non';
      case 'unknown': return 'Inconnu';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-xl">
            {isEditing ? 'Modifier l\'infrastructure' : 'Déclarer une infrastructure'}
          </DialogTitle>
          <DialogDescription>
            Décrivez un serveur existant. Aucune action ne sera exécutée.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-180px)]">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="px-6 pb-6 space-y-6">
              {/* INFORMATIONS GÉNÉRALES */}
              <section>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                  Informations générales
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom de l'infrastructure *</FormLabel>
                        <FormControl>
                          <Input placeholder="VPS-Production-01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="vps">
                              <div className="flex items-center gap-2">
                                <Server className="w-4 h-4" />
                                VPS
                              </div>
                            </SelectItem>
                            <SelectItem value="bare_metal">
                              <div className="flex items-center gap-2">
                                <HardDrive className="w-4 h-4" />
                                Bare Metal
                              </div>
                            </SelectItem>
                            <SelectItem value="cloud">
                              <div className="flex items-center gap-2">
                                <Cloud className="w-4 h-4" />
                                Cloud
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem className="mt-4">
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Serveur principal de production..."
                          className="resize-none"
                          rows={3}
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </section>

              {/* SYSTÈME & RESSOURCES */}
              <section>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                  Système & Ressources
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="os"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Système d'exploitation</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ''}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Choisir" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {OS_OPTIONS.map(os => (
                              <SelectItem key={os} value={os}>{os}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
                  <FormField
                    control={form.control}
                    name="architecture"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Architecture</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ''}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Choisir" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {ARCH_OPTIONS.map(arch => (
                              <SelectItem key={arch.value} value={arch.value}>{arch.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4 mt-4">
                  <FormField
                    control={form.control}
                    name="cpu_cores"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CPU (cores)</FormLabel>
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
                  <FormField
                    control={form.control}
                    name="ram_gb"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>RAM (Go)</FormLabel>
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
                  <FormField
                    control={form.control}
                    name="disk_gb"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Disque (Go)</FormLabel>
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
              </section>

              {/* FOURNISSEUR & LOCALISATION */}
              <section>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                  Fournisseur & Localisation
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="provider"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fournisseur</FormLabel>
                        <FormControl>
                          <Input placeholder="OVH, Contabo, Hetzner, Local..." {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Localisation</FormLabel>
                        <FormControl>
                          <Input placeholder="Abidjan, Paris, Frankfurt..." {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </section>

              {/* CAPACITÉS DÉCLARÉES */}
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Capacités déclarées
                  </h3>
                  <Info className="w-3 h-3 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  Déclarez ce qui est disponible sur ce serveur. Le runner pourra confirmer.
                </p>
                
                <div className="grid grid-cols-2 gap-3">
                  {CAPABILITIES.map((cap) => (
                    <div 
                      key={cap.key}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50"
                    >
                      <div>
                        <p className="font-medium text-sm">{cap.label}</p>
                        <p className="text-xs text-muted-foreground">{cap.description}</p>
                      </div>
                      <Select
                        value={capabilities[cap.key]}
                        onValueChange={(value: CapabilityStatus) => 
                          setCapabilities(prev => ({ ...prev, [cap.key]: value }))
                        }
                      >
                        <SelectTrigger className="w-28 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="installed">Installé</SelectItem>
                          <SelectItem value="not_installed">Non</SelectItem>
                          <SelectItem value="unknown">Inconnu</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </section>
            </form>
          </Form>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t border-border/50">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button 
            onClick={form.handleSubmit(handleSubmit)} 
            disabled={isLoading}
          >
            {isLoading ? 'Enregistrement...' : isEditing ? 'Mettre à jour' : 'Déclarer l\'infrastructure'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}