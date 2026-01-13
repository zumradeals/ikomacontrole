import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Globe, Server, Lock, AlertTriangle, Loader2 } from "lucide-react";

type RoutingType = "root_only" | "subdomain_only" | "root_and_subdomain";

const routeSchema = z.object({
  routingType: z.enum(["root_only", "subdomain_only", "root_and_subdomain"]),
  domain: z
    .string()
    .min(1, "Le domaine est requis")
    .regex(
      /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/,
      "Format de domaine invalide (ex: exemple.com)"
    ),
  subdomain: z
    .string()
    .regex(/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/, {
      message: "Format de sous-domaine invalide (ex: api, app, www)",
    })
    .optional()
    .or(z.literal("")),
  backendHost: z
    .string()
    .min(1, "L'hôte backend est requis")
    .regex(
      /^(localhost|127\.0\.0\.1|[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/,
      "Format d'hôte invalide"
    ),
  backendPort: z
    .string()
    .regex(/^\d+$/, "Le port doit être un nombre")
    .refine(
      (val) => {
        const num = parseInt(val, 10);
        return num >= 1 && num <= 65535;
      },
      { message: "Le port doit être entre 1 et 65535" }
    ),
  backendProtocol: z.enum(["http", "https"]).default("http"),
});

type RouteFormValues = z.infer<typeof routeSchema>;

export interface NginxRouteSubmitData {
  routingType: RoutingType;
  domain: string;
  subdomain: string | null;
  fullDomain: string;
  backendHost: string;
  backendPort: number;
  backendProtocol: string;
}

const ROUTING_OPTIONS: {
  value: RoutingType;
  label: string;
  description: string;
  example: string;
}[] = [
  {
    value: "root_only",
    label: "Domaine racine uniquement",
    description: "Le trafic sera routé uniquement depuis le domaine racine",
    example: "exemple.com → backend",
  },
  {
    value: "subdomain_only",
    label: "Sous-domaine uniquement",
    description: "Le trafic sera routé uniquement depuis un sous-domaine spécifique",
    example: "api.exemple.com → backend",
  },
  {
    value: "root_and_subdomain",
    label: "Racine + Sous-domaine",
    description: "Créera deux routes: une pour le domaine racine et une pour le sous-domaine",
    example: "exemple.com + api.exemple.com → backend",
  },
];

interface NginxRouteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: NginxRouteSubmitData) => Promise<void>;
  isLoading?: boolean;
  hasActiveRunner?: boolean;
}

export function NginxRouteDialog({
  open,
  onOpenChange,
  onSubmit,
  isLoading = false,
  hasActiveRunner = false,
}: NginxRouteDialogProps) {
  const [localLoading, setLocalLoading] = useState(false);

  const form = useForm<RouteFormValues>({
    resolver: zodResolver(routeSchema),
    defaultValues: {
      routingType: "root_only",
      domain: "",
      subdomain: "",
      backendHost: "localhost",
      backendPort: "8000",
      backendProtocol: "http",
    },
  });

  const routingType = form.watch("routingType");
  const domain = form.watch("domain");
  const subdomain = form.watch("subdomain");

  useEffect(() => {
    if (routingType === "root_only") {
      form.setValue("subdomain", "");
    }
  }, [routingType, form]);

  const handleSubmit = async (values: RouteFormValues) => {
    setLocalLoading(true);
    try {
      const fullDomain =
        values.routingType === "root_only" || !values.subdomain
          ? values.domain
          : `${values.subdomain}.${values.domain}`;

      await onSubmit({
        routingType: values.routingType,
        domain: values.domain,
        subdomain: values.subdomain || null,
        fullDomain,
        backendHost: values.backendHost,
        backendPort: parseInt(values.backendPort, 10),
        backendProtocol: values.backendProtocol,
      });

      form.reset();
      onOpenChange(false);
    } finally {
      setLocalLoading(false);
    }
  };

  const isSubmitting = localLoading || isLoading;

  const getPreview = (): string[] => {
    if (!domain) return [];
    const previews: string[] = [];

    if (routingType === "root_only" || routingType === "root_and_subdomain") {
      previews.push(`https://${domain}`);
    }
    if (
      (routingType === "subdomain_only" || routingType === "root_and_subdomain") &&
      subdomain
    ) {
      previews.push(`https://${subdomain}.${domain}`);
    }

    return previews;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Ajouter une route Nginx
          </DialogTitle>
          <DialogDescription>
            Configurez un reverse proxy Nginx avec certificat HTTPS via Certbot
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Routing Type */}
            <FormField
              control={form.control}
              name="routingType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type de routage</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="space-y-3"
                    >
                      {ROUTING_OPTIONS.map((option) => (
                        <div
                          key={option.value}
                          className="flex items-start space-x-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                        >
                          <RadioGroupItem value={option.value} id={option.value} />
                          <div className="space-y-1 flex-1">
                            <label
                              htmlFor={option.value}
                              className="text-sm font-medium cursor-pointer"
                            >
                              {option.label}
                            </label>
                            <p className="text-xs text-muted-foreground">
                              {option.description}
                            </p>
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                              {option.example}
                            </code>
                          </div>
                        </div>
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Domain */}
            <FormField
              control={form.control}
              name="domain"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Domaine racine</FormLabel>
                  <FormControl>
                    <Input placeholder="exemple.com" {...field} />
                  </FormControl>
                  <FormDescription>
                    Le domaine principal (sans sous-domaine)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Subdomain (conditional) */}
            {routingType !== "root_only" && (
              <FormField
                control={form.control}
                name="subdomain"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sous-domaine</FormLabel>
                    <FormControl>
                      <Input placeholder="api, app, www..." {...field} />
                    </FormControl>
                    <FormDescription>
                      Le préfixe du sous-domaine (ex: api, app, dashboard)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Backend Configuration */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Server className="h-4 w-4" />
                Configuration Backend
              </h4>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="backendHost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hôte</FormLabel>
                      <FormControl>
                        <Input placeholder="localhost" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="backendPort"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Port</FormLabel>
                      <FormControl>
                        <Input placeholder="8000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="backendProtocol"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Protocole</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="flex gap-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="http" id="http" />
                          <label htmlFor="http" className="text-sm cursor-pointer">
                            HTTP
                          </label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="https" id="https" />
                          <label htmlFor="https" className="text-sm cursor-pointer">
                            HTTPS
                          </label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormDescription>
                      Protocole utilisé pour communiquer avec le backend
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Runner Warning */}
            {!hasActiveRunner && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Aucun runner actif détecté. La configuration sera enregistrée mais ne
                  pourra pas être appliquée tant qu'un runner n'est pas actif.
                </AlertDescription>
              </Alert>
            )}

            {/* Preview */}
            {getPreview().length > 0 && (
              <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Lock className="h-4 w-4 text-green-600" />
                  Aperçu des routes
                </h4>
                <div className="flex flex-wrap gap-2">
                  {getPreview().map((url, i) => (
                    <Badge key={i} variant="secondary" className="font-mono text-xs">
                      {url}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Ajouter la route
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
