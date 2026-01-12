import { useState, useEffect } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Globe, Server, Plus, Loader2, AlertTriangle, Info } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

// Types de routage disponibles
type RoutingType = 'root_only' | 'subdomain_only' | 'root_and_subdomain';

const routeSchema = z.object({
  routing_type: z.enum(['root_only', 'subdomain_only', 'root_and_subdomain']),
  domain: z
    .string()
    .trim()
    .min(1, 'Le domaine est requis')
    .max(253, 'Domaine trop long')
    .regex(
      /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/,
      'Domaine invalide (ex: example.com)'
    ),
  subdomain: z
    .string()
    .trim()
    .max(63, 'Sous-domaine trop long')
    .regex(/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/, 'Sous-domaine invalide')
    .optional()
    .or(z.literal('')),
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
}).refine((data) => {
  // Validation conditionnelle : subdomain requis si routing_type inclut subdomain
  if (data.routing_type === 'subdomain_only' || data.routing_type === 'root_and_subdomain') {
    return data.subdomain && data.subdomain.length > 0;
  }
  return true;
}, {
  message: 'Le sous-domaine est requis pour ce type de routage',
  path: ['subdomain'],
});

type RouteFormValues = z.infer<typeof routeSchema>;

export interface CaddyRouteSubmitData {
  routing_type: RoutingType;
  domain: string;
  subdomain?: string;
  backend_host: string;
  backend_port: number;
  backend_protocol: string;
}

interface CaddyRouteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CaddyRouteSubmitData) => Promise<void>;
  isLoading?: boolean;
  hasActiveRunner?: boolean;
}

const ROUTING_OPTIONS = [
  {
    value: 'root_only' as const,
    label: 'Domaine racine uniquement',
    description: 'example.com → backend',
    example: 'example.com',
  },
  {
    value: 'subdomain_only' as const,
    label: 'Sous-domaine uniquement',
    description: 'app.example.com → backend',
    example: 'app.example.com',
  },
  {
    value: 'root_and_subdomain' as const,
    label: 'Domaine + sous-domaine',
    description: 'example.com et app.example.com → backend',
    example: 'example.com + app.example.com',
  },
];

export function CaddyRouteDialog({
  open,
  onOpenChange,
  onSubmit,
  isLoading = false,
  hasActiveRunner = true,
}: CaddyRouteDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<RouteFormValues>({
    resolver: zodResolver(routeSchema),
    defaultValues: {
      routing_type: 'subdomain_only',
      domain: '',
      subdomain: '',
      backend_host: 'localhost',
      backend_port: '3000',
      protocol: 'http',
    },
  });

  const routingType = form.watch('routing_type');
  const domain = form.watch('domain');
  const subdomain = form.watch('subdomain');

  // Reset subdomain when switching to root_only
  useEffect(() => {
    if (routingType === 'root_only') {
      form.setValue('subdomain', '');
    }
  }, [routingType, form]);

  const handleSubmit = async (values: RouteFormValues) => {
    if (!hasActiveRunner) return;
    
    setSubmitting(true);
    try {
      await onSubmit({
        routing_type: values.routing_type,
        domain: values.domain,
        subdomain: values.subdomain || undefined,
        backend_host: values.backend_host,
        backend_port: parseInt(values.backend_port, 10),
        backend_protocol: values.protocol,
      });
      form.reset();
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  const isSubmitting = submitting || isLoading;

  // Génère l'aperçu des domaines
  const getPreview = () => {
    const d = domain || 'example.com';
    const s = subdomain || 'app';
    
    switch (routingType) {
      case 'root_only':
        return [d];
      case 'subdomain_only':
        return [`${s}.${d}`];
      case 'root_and_subdomain':
        return [d, `${s}.${d}`];
      default:
        return [];
    }
  };

  // Common port presets
  const portPresets = [
    { label: 'Node.js (3000)', value: '3000' },
    { label: 'React Dev (5173)', value: '5173' },
    { label: 'Django (8000)', value: '8000' },
    { label: 'Flask (5000)', value: '5000' },
    { label: 'Rails (3001)', value: '3001' },
    { label: 'Supabase (8000)', value: '8000' },
  ];

  const showSubdomainField = routingType === 'subdomain_only' || routingType === 'root_and_subdomain';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            Ajouter une route Caddy
          </DialogTitle>
          <DialogDescription>
            Configurez un reverse proxy pour rediriger un domaine vers un service backend.
          </DialogDescription>
        </DialogHeader>

        {!hasActiveRunner && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Aucun runner actif.</strong> Un runner en ligne est requis pour exécuter la configuration Caddy.
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Type de routage */}
            <FormField
              control={form.control}
              name="routing_type"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Type de routage *</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex flex-col space-y-2"
                      disabled={isSubmitting}
                    >
                      {ROUTING_OPTIONS.map((option) => (
                        <div
                          key={option.value}
                          className={`flex items-start space-x-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                            field.value === option.value
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:bg-muted/50'
                          }`}
                          onClick={() => field.onChange(option.value)}
                        >
                          <RadioGroupItem value={option.value} id={option.value} className="mt-0.5" />
                          <div className="flex-1">
                            <Label htmlFor={option.value} className="font-medium cursor-pointer">
                              {option.label}
                            </Label>
                            <p className="text-sm text-muted-foreground">{option.description}</p>
                          </div>
                        </div>
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Info pour domaine racine hébergé ailleurs */}
            {routingType === 'subdomain_only' && (
              <Alert className="border-blue-500/30 bg-blue-500/5">
                <Info className="h-4 w-4 text-blue-500" />
                <AlertDescription className="text-sm">
                  Le domaine racine peut rester hébergé ailleurs (ex: site vitrine, landing page).
                  Seul le sous-domaine sera redirigé vers votre backend.
                </AlertDescription>
              </Alert>
            )}

            {/* Domaine racine */}
            <FormField
              control={form.control}
              name="domain"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Domaine racine *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="example.com"
                        className="pl-10"
                        {...field}
                        disabled={isSubmitting}
                      />
                    </div>
                  </FormControl>
                  <FormDescription>
                    Le domaine principal (sans www, sans sous-domaine)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Sous-domaine (conditionnel) */}
            {showSubdomainField && (
              <FormField
                control={form.control}
                name="subdomain"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sous-domaine *</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="app, api, dashboard..."
                          {...field}
                          disabled={isSubmitting}
                          className="flex-1"
                        />
                        <span className="text-muted-foreground">.{domain || 'example.com'}</span>
                      </div>
                    </FormControl>
                    <FormDescription>
                      Le préfixe du sous-domaine (ex: app, api, admin)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

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

            {/* Preview */}
            <div className="rounded-lg border border-border p-4 bg-muted/50">
              <p className="text-xs text-muted-foreground mb-2">Routes qui seront créées:</p>
              <div className="space-y-1">
                {getPreview().map((preview, idx) => (
                  <code key={idx} className="block text-sm font-mono text-primary">
                    https://{preview} → {form.watch('protocol')}://{form.watch('backend_host')}:{form.watch('backend_port')}
                  </code>
                ))}
              </div>
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
              <Button type="submit" disabled={isSubmitting || !hasActiveRunner}>
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
