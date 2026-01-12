import { useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Database, Globe, Lock, Loader2, Play, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';

const installSchema = z.object({
  instance_name: z
    .string()
    .trim()
    .min(1, "Le nom d'instance est requis")
    .max(32, 'Nom trop long (max 32 caractères)')
    .regex(
      /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/,
      'Nom invalide (lettres minuscules, chiffres, tirets, doit commencer/finir par alphanumérique)'
    ),
  network_mode: z.enum(['local', 'public']),
  domain: z.string().optional(),
}).refine(
  (data) => {
    if (data.network_mode === 'public') {
      return data.domain && data.domain.length > 0;
    }
    return true;
  },
  {
    message: 'Le domaine est requis en mode Public',
    path: ['domain'],
  }
).refine(
  (data) => {
    if (data.network_mode === 'public' && data.domain) {
      return /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/.test(data.domain);
    }
    return true;
  },
  {
    message: 'Domaine invalide (ex: supabase.example.com)',
    path: ['domain'],
  }
);

type InstallFormValues = z.infer<typeof installSchema>;

export interface SupabaseInstallConfig {
  instanceName: string;
  networkMode: 'local' | 'public';
  domain?: string;
}

interface SupabaseInstallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInstall: (config: SupabaseInstallConfig) => Promise<void>;
  isLoading?: boolean;
  precheckPassed?: boolean;
}

export function SupabaseInstallDialog({
  open,
  onOpenChange,
  onInstall,
  isLoading = false,
  precheckPassed = false,
}: SupabaseInstallDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<InstallFormValues>({
    resolver: zodResolver(installSchema),
    defaultValues: {
      instance_name: 'prod',
      network_mode: 'local',
      domain: '',
    },
  });

  const networkMode = form.watch('network_mode');

  const handleSubmit = async (values: InstallFormValues) => {
    setSubmitting(true);
    try {
      await onInstall({
        instanceName: values.instance_name,
        networkMode: values.network_mode,
        domain: values.network_mode === 'public' ? values.domain : undefined,
      });
      form.reset();
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  const isSubmitting = submitting || isLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="w-5 h-5 text-primary" />
            Installer Supabase Self-Hosted
          </DialogTitle>
          <DialogDescription>
            Configure et déploie une instance Supabase complète via Docker Compose.
          </DialogDescription>
        </DialogHeader>

        {!precheckPassed && (
          <Alert variant="destructive">
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>
              Le precheck n'a pas été validé. Exécutez d'abord le precheck pour vérifier les prérequis.
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Instance Name */}
            <FormField
              control={form.control}
              name="instance_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom d'instance</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="prod"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormDescription>
                    Identifiant unique pour cette installation (ex: prod, staging, dev)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Network Mode */}
            <FormField
              control={form.control}
              name="network_mode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mode réseau</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={isSubmitting}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner le mode" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="local">
                        <div className="flex items-center gap-2">
                          <Lock className="w-4 h-4" />
                          <span>Local Only</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="public">
                        <div className="flex items-center gap-2">
                          <Globe className="w-4 h-4" />
                          <span>Public (avec domaine)</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {field.value === 'local' 
                      ? 'Accessible uniquement sur localhost (développement)'
                      : 'Accessible via un domaine public avec HTTPS automatique'
                    }
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Domain (only for public mode) */}
            {networkMode === 'public' && (
              <FormField
                control={form.control}
                name="domain"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Domaine</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="supabase.example.com"
                          className="pl-10"
                          {...field}
                          disabled={isSubmitting}
                        />
                      </div>
                    </FormControl>
                    <FormDescription>
                      Ce domaine doit pointer vers ce serveur (A record). 
                      Caddy obtiendra automatiquement un certificat TLS.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Info box */}
            <div className="rounded-lg border border-border p-4 bg-muted/50 space-y-2">
              <p className="text-sm font-medium">Cette installation va :</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Télécharger le stack Docker officiel Supabase</li>
                <li>• Générer des secrets aléatoires sécurisés</li>
                <li>• Configurer l'environnement ({networkMode === 'public' ? 'mode public' : 'mode local'})</li>
                <li>• Démarrer tous les containers (DB, Auth, REST, Realtime, Storage, Studio)</li>
                {networkMode === 'public' && (
                  <li>• Configurer Caddy comme reverse proxy avec HTTPS</li>
                )}
                <li>• Vérifier le healthcheck final</li>
              </ul>
            </div>

            {/* Preview */}
            <div className="rounded-lg border border-border p-4 bg-muted/30">
              <p className="text-xs text-muted-foreground mb-2">Installation prévue :</p>
              <code className="text-sm font-mono text-primary block">
                /opt/ikoma/platform/supabase/{form.watch('instance_name') || 'default'}/
              </code>
              {networkMode === 'public' && form.watch('domain') && (
                <code className="text-sm font-mono text-green-400 block mt-1">
                  https://{form.watch('domain')}
                </code>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Annuler
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting || !precheckPassed}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Installation en cours...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Installer Supabase
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
