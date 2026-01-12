import { useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Globe, Server, Plus, Loader2 } from 'lucide-react';
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
import { Switch } from '@/components/ui/switch';

const routeSchema = z.object({
  domain: z
    .string()
    .trim()
    .min(1, 'Le domaine est requis')
    .max(253, 'Domaine trop long')
    .regex(
      /^(\*\.)?([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/,
      'Domaine invalide (ex: app.example.com ou *.example.com)'
    ),
  backend_host: z
    .string()
    .trim()
    .min(1, "L'hôte backend est requis")
    .max(255, 'Hôte trop long'),
  backend_port: z
    .string()
    .regex(/^\d{1,5}$/, 'Port invalide')
    .refine((val) => {
      const port = parseInt(val, 10);
      return port >= 1 && port <= 65535;
    }, 'Port doit être entre 1 et 65535'),
  protocol: z.enum(['http', 'https']),
  enable_https: z.boolean(),
});

type RouteFormValues = z.infer<typeof routeSchema>;

interface CaddyRouteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (domain: string, backendUrl: string, enableHttps: boolean) => Promise<void>;
  isLoading?: boolean;
}

export function CaddyRouteDialog({
  open,
  onOpenChange,
  onSubmit,
  isLoading = false,
}: CaddyRouteDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<RouteFormValues>({
    resolver: zodResolver(routeSchema),
    defaultValues: {
      domain: '',
      backend_host: 'localhost',
      backend_port: '3000',
      protocol: 'http',
      enable_https: true,
    },
  });

  const handleSubmit = async (values: RouteFormValues) => {
    setSubmitting(true);
    try {
      const backendUrl = `${values.protocol}://${values.backend_host}:${values.backend_port}`;
      await onSubmit(values.domain, backendUrl, values.enable_https);
      form.reset();
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  const isSubmitting = submitting || isLoading;

  // Common port presets
  const portPresets = [
    { label: 'Node.js (3000)', value: '3000' },
    { label: 'React Dev (5173)', value: '5173' },
    { label: 'Django (8000)', value: '8000' },
    { label: 'Flask (5000)', value: '5000' },
    { label: 'Rails (3001)', value: '3001' },
    { label: 'Supabase (8000)', value: '8000' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            Ajouter une route Caddy
          </DialogTitle>
          <DialogDescription>
            Configurez un reverse proxy pour rediriger un domaine vers un service backend.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Domain */}
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
                        placeholder="app.example.com"
                        className="pl-10"
                        {...field}
                        disabled={isSubmitting}
                      />
                    </div>
                  </FormControl>
                  <FormDescription>
                    Le domaine qui sera redirigé (wildcard supporté: *.example.com)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Backend Configuration */}
            <div className="space-y-4 rounded-lg border border-border p-4 bg-muted/30">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Server className="w-4 h-4" />
                Configuration Backend
              </h4>

              <div className="grid grid-cols-2 gap-4">
                {/* Protocol */}
                <FormField
                  control={form.control}
                  name="protocol"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Protocole</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        disabled={isSubmitting}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Protocole" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="http">HTTP</SelectItem>
                          <SelectItem value="https">HTTPS</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Backend Host */}
                <FormField
                  control={form.control}
                  name="backend_host"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hôte</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="localhost"
                          {...field}
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Backend Port */}
              <FormField
                control={form.control}
                name="backend_port"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Port</FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input
                          placeholder="3000"
                          className="flex-1"
                          {...field}
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <Select
                        onValueChange={(val) => form.setValue('backend_port', val)}
                        disabled={isSubmitting}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Presets" />
                        </SelectTrigger>
                        <SelectContent>
                          {portPresets.map((preset) => (
                            <SelectItem key={preset.value} value={preset.value}>
                              {preset.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* HTTPS Auto */}
            <FormField
              control={form.control}
              name="enable_https"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-4 bg-muted/30">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">HTTPS automatique</FormLabel>
                    <FormDescription>
                      Caddy obtiendra automatiquement un certificat Let's Encrypt
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Preview */}
            <div className="rounded-lg border border-border p-4 bg-muted/50">
              <p className="text-xs text-muted-foreground mb-2">Aperçu de la configuration:</p>
              <code className="text-sm font-mono text-primary">
                {form.watch('domain') || 'domaine.com'} → {form.watch('protocol')}://
                {form.watch('backend_host')}:{form.watch('backend_port')}
              </code>
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
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Ajout en cours...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Ajouter la route
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
