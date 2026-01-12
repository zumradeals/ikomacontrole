import { useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  GitBranch, 
  Server, 
  Settings, 
  Eye, 
  Rocket,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Globe,
  Terminal,
  Package,
  FileCode,
  CheckCircle2,
} from 'lucide-react';
import { useRunners } from '@/hooks/useRunners';
import { useInfrastructures } from '@/hooks/useInfrastructures';
import { 
  useCreateDeployment, 
  useCreateDeploymentSteps,
  useUpdateDeployment,
  generateDeploymentSteps,
  DeploymentType,
  HealthcheckType,
  CreateDeploymentInput,
} from '@/hooks/useDeployments';

const sourceSchema = z.object({
  app_name: z
    .string()
    .trim()
    .min(1, "Nom requis")
    .max(64, "Trop long")
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/, 'Lettres minuscules, chiffres, tirets'),
  repo_url: z
    .string()
    .trim()
    .min(1, "URL requise")
    .regex(/^(https?:\/\/|git@)/, 'URL Git invalide'),
  branch: z.string().trim().min(1, "Branche requise"),
  deploy_type: z.enum(['nodejs', 'docker_compose', 'static_site', 'custom']),
});

const targetSchema = z.object({
  runner_id: z.string().uuid("Sélectionnez un runner"),
  infrastructure_id: z.string().uuid().optional(),
});

const configSchema = z.object({
  port: z.coerce.number().min(1).max(65535),
  start_command: z.string().optional(),
  healthcheck_type: z.enum(['http', 'tcp', 'command']),
  healthcheck_value: z.string().optional(),
  expose_via_caddy: z.boolean(),
  domain: z.string().optional(),
  env_vars: z.string().optional(), // Will be parsed as key=value pairs
});

type WizardStep = 'source' | 'target' | 'config' | 'preview';

const STEPS: { key: WizardStep; label: string; icon: React.ReactNode }[] = [
  { key: 'source', label: 'Source', icon: <GitBranch className="w-4 h-4" /> },
  { key: 'target', label: 'Cible', icon: <Server className="w-4 h-4" /> },
  { key: 'config', label: 'Configuration', icon: <Settings className="w-4 h-4" /> },
  { key: 'preview', label: 'Prévisualisation', icon: <Eye className="w-4 h-4" /> },
];

const DEPLOY_TYPES: { value: DeploymentType; label: string; icon: React.ReactNode }[] = [
  { value: 'nodejs', label: 'Node.js', icon: <Package className="w-4 h-4" /> },
  { value: 'docker_compose', label: 'Docker Compose', icon: <Server className="w-4 h-4" /> },
  { value: 'static_site', label: 'Site Statique', icon: <FileCode className="w-4 h-4" /> },
];

interface DeployWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeploymentCreated?: (deploymentId: string) => void;
}

export function DeployWizard({ open, onOpenChange, onDeploymentCreated }: DeployWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('source');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { data: runners } = useRunners();
  const { data: infrastructures } = useInfrastructures();
  const createDeployment = useCreateDeployment();
  const createSteps = useCreateDeploymentSteps();
  const updateDeployment = useUpdateDeployment();

  const onlineRunners = runners?.filter(r => r.status === 'online') || [];

  const sourceForm = useForm<z.infer<typeof sourceSchema>>({
    resolver: zodResolver(sourceSchema),
    defaultValues: {
      app_name: '',
      repo_url: '',
      branch: 'main',
      deploy_type: 'nodejs',
    },
  });

  const targetForm = useForm<z.infer<typeof targetSchema>>({
    resolver: zodResolver(targetSchema),
    defaultValues: {
      runner_id: '',
      infrastructure_id: undefined,
    },
  });

  const configForm = useForm<z.infer<typeof configSchema>>({
    resolver: zodResolver(configSchema),
    defaultValues: {
      port: 3000,
      start_command: '',
      healthcheck_type: 'http',
      healthcheck_value: '/',
      expose_via_caddy: false,
      domain: '',
      env_vars: '',
    },
  });

  const stepIndex = STEPS.findIndex(s => s.key === currentStep);

  const canGoNext = () => {
    switch (currentStep) {
      case 'source':
        return sourceForm.formState.isValid;
      case 'target':
        return targetForm.formState.isValid;
      case 'config':
        return configForm.formState.isValid;
      default:
        return true;
    }
  };

  const handleNext = async () => {
    switch (currentStep) {
      case 'source':
        const sourceValid = await sourceForm.trigger();
        if (sourceValid) setCurrentStep('target');
        break;
      case 'target':
        const targetValid = await targetForm.trigger();
        if (targetValid) setCurrentStep('config');
        break;
      case 'config':
        const configValid = await configForm.trigger();
        if (configValid) setCurrentStep('preview');
        break;
    }
  };

  const handleBack = () => {
    const idx = STEPS.findIndex(s => s.key === currentStep);
    if (idx > 0) {
      setCurrentStep(STEPS[idx - 1].key);
    }
  };

  const parseEnvVars = (envString: string): Record<string, string> => {
    const vars: Record<string, string> = {};
    if (!envString) return vars;
    
    envString.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex > 0) {
        const key = trimmed.slice(0, eqIndex).trim();
        const value = trimmed.slice(eqIndex + 1).trim().replace(/^["']|["']$/g, '');
        vars[key] = value;
      }
    });
    return vars;
  };

  const getDeploymentInput = (): CreateDeploymentInput => {
    const source = sourceForm.getValues();
    const target = targetForm.getValues();
    const config = configForm.getValues();

    return {
      app_name: source.app_name,
      repo_url: source.repo_url,
      branch: source.branch,
      deploy_type: source.deploy_type as DeploymentType,
      runner_id: target.runner_id,
      infrastructure_id: target.infrastructure_id,
      port: config.port,
      start_command: config.start_command || undefined,
      healthcheck_type: config.healthcheck_type as HealthcheckType,
      healthcheck_value: config.healthcheck_value || '/',
      expose_via_caddy: config.expose_via_caddy,
      domain: config.domain || undefined,
      env_vars: parseEnvVars(config.env_vars || ''),
    };
  };

  const generatedSteps = currentStep === 'preview' ? generateDeploymentSteps(getDeploymentInput()) : [];

  const handleDeploy = async () => {
    setIsSubmitting(true);
    try {
      const input = getDeploymentInput();
      
      // Create deployment
      const deployment = await createDeployment.mutateAsync(input);
      
      // Generate and create steps
      const steps = generateDeploymentSteps(input);
      await createSteps.mutateAsync({
        deploymentId: deployment.id,
        steps,
      });

      // Update status to ready
      await updateDeployment.mutateAsync({
        id: deployment.id,
        status: 'ready',
        working_dir: `/opt/ikoma/apps/${input.app_name}`,
      });

      onDeploymentCreated?.(deployment.id);
      onOpenChange(false);
      resetForms();
    } catch (error) {
      console.error('Failed to create deployment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForms = () => {
    sourceForm.reset();
    targetForm.reset();
    configForm.reset();
    setCurrentStep('source');
  };

  const getRunnerInfra = (runnerId: string) => {
    const runner = runners?.find(r => r.id === runnerId);
    if (!runner?.infrastructure_id) return null;
    return infrastructures?.find(i => i.id === runner.infrastructure_id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="w-5 h-5 text-primary" />
            Nouveau Déploiement
          </DialogTitle>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center justify-between px-2 py-3 border-b">
          {STEPS.map((step, idx) => (
            <div key={step.key} className="flex items-center">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors ${
                currentStep === step.key
                  ? 'bg-primary text-primary-foreground'
                  : stepIndex > idx
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-muted text-muted-foreground'
              }`}>
                {stepIndex > idx ? <CheckCircle2 className="w-4 h-4" /> : step.icon}
                <span className="hidden sm:inline">{step.label}</span>
              </div>
              {idx < STEPS.length - 1 && (
                <div className={`w-8 h-0.5 mx-2 ${stepIndex > idx ? 'bg-green-500' : 'bg-muted'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <ScrollArea className="flex-1 px-1">
          <div className="py-4">
            {/* Step 1: Source */}
            {currentStep === 'source' && (
              <Form {...sourceForm}>
                <form className="space-y-4">
                  <FormField
                    control={sourceForm.control}
                    name="app_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom de l'application</FormLabel>
                        <FormControl>
                          <Input placeholder="my-app" {...field} />
                        </FormControl>
                        <FormDescription>Identifiant unique (lettres minuscules, chiffres, tirets)</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={sourceForm.control}
                    name="repo_url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL du Repository Git</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <GitBranch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input placeholder="https://github.com/user/repo.git" className="pl-10" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={sourceForm.control}
                    name="branch"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Branche</FormLabel>
                        <FormControl>
                          <Input placeholder="main" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={sourceForm.control}
                    name="deploy_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type de déploiement</FormLabel>
                        <div className="grid grid-cols-3 gap-3">
                          {DEPLOY_TYPES.map(type => (
                            <button
                              key={type.value}
                              type="button"
                              onClick={() => field.onChange(type.value)}
                              className={`p-4 rounded-lg border text-center transition-all ${
                                field.value === type.value
                                  ? 'border-primary bg-primary/10'
                                  : 'border-border hover:border-primary/50'
                              }`}
                            >
                              <div className="flex flex-col items-center gap-2">
                                {type.icon}
                                <span className="text-sm font-medium">{type.label}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </form>
              </Form>
            )}

            {/* Step 2: Target */}
            {currentStep === 'target' && (
              <Form {...targetForm}>
                <form className="space-y-4">
                  <FormField
                    control={targetForm.control}
                    name="runner_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Runner</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner un runner en ligne" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {onlineRunners.length === 0 ? (
                              <div className="p-4 text-center text-muted-foreground text-sm">
                                Aucun runner en ligne
                              </div>
                            ) : (
                              onlineRunners.map(runner => {
                                const infra = getRunnerInfra(runner.id);
                                return (
                                  <SelectItem key={runner.id} value={runner.id}>
                                    <div className="flex items-center gap-2">
                                      <Server className="w-4 h-4" />
                                      <span>{runner.name}</span>
                                      {infra && (
                                        <Badge variant="outline" className="text-xs">
                                          {infra.name}
                                        </Badge>
                                      )}
                                    </div>
                                  </SelectItem>
                                );
                              })
                            )}
                          </SelectContent>
                        </Select>
                        <FormDescription>Seuls les runners en ligne sont affichés</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {targetForm.watch('runner_id') && (
                    <div className="rounded-lg border border-border p-4 bg-muted/30">
                      <h4 className="text-sm font-medium mb-2">Infrastructure associée</h4>
                      {(() => {
                        const infra = getRunnerInfra(targetForm.watch('runner_id'));
                        if (!infra) {
                          return <p className="text-sm text-muted-foreground">Aucune infrastructure liée</p>;
                        }
                        return (
                          <div className="text-sm space-y-1">
                            <p><span className="text-muted-foreground">Nom:</span> {infra.name}</p>
                            <p><span className="text-muted-foreground">Type:</span> {infra.type}</p>
                            {infra.os && <p><span className="text-muted-foreground">OS:</span> {infra.os}</p>}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </form>
              </Form>
            )}

            {/* Step 3: Config */}
            {currentStep === 'config' && (
              <Form {...configForm}>
                <form className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={configForm.control}
                      name="port"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Port</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={configForm.control}
                      name="start_command"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Commande de démarrage</FormLabel>
                          <FormControl>
                            <Input placeholder="npm start" {...field} />
                          </FormControl>
                          <FormDescription>Laissez vide pour auto-détection</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={configForm.control}
                    name="healthcheck_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type de healthcheck</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="http">HTTP (GET)</SelectItem>
                            <SelectItem value="tcp">TCP Port</SelectItem>
                            <SelectItem value="command">Commande</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={configForm.control}
                    name="healthcheck_value"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {configForm.watch('healthcheck_type') === 'http' 
                            ? 'Chemin HTTP' 
                            : configForm.watch('healthcheck_type') === 'command'
                              ? 'Commande'
                              : 'Port'
                          }
                        </FormLabel>
                        <FormControl>
                          <Input 
                            placeholder={
                              configForm.watch('healthcheck_type') === 'http' 
                                ? '/' 
                                : configForm.watch('healthcheck_type') === 'command'
                                  ? 'curl -sf http://localhost:3000'
                                  : '3000'
                            }
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Separator />

                  <FormField
                    control={configForm.control}
                    name="expose_via_caddy"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel>Exposer via Caddy</FormLabel>
                          <FormDescription>Configurer automatiquement un reverse proxy avec HTTPS</FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {configForm.watch('expose_via_caddy') && (
                    <FormField
                      control={configForm.control}
                      name="domain"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Domaine</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                              <Input placeholder="app.example.com" className="pl-10" {...field} />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={configForm.control}
                    name="env_vars"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Variables d'environnement</FormLabel>
                        <FormControl>
                          <textarea
                            className="w-full h-24 px-3 py-2 text-sm rounded-md border border-input bg-background font-mono"
                            placeholder="KEY=value&#10;DATABASE_URL=postgres://..."
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>Une variable par ligne (KEY=value)</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </form>
              </Form>
            )}

            {/* Step 4: Preview */}
            {currentStep === 'preview' && (
              <div className="space-y-4">
                <div className="rounded-lg border border-border p-4 bg-muted/30">
                  <h4 className="font-medium mb-3">Résumé du déploiement</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Application</p>
                      <p className="font-mono">{sourceForm.watch('app_name')}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Type</p>
                      <p>{DEPLOY_TYPES.find(t => t.value === sourceForm.watch('deploy_type'))?.label}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Repository</p>
                      <p className="font-mono text-xs truncate">{sourceForm.watch('repo_url')}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Branche</p>
                      <p>{sourceForm.watch('branch')}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Port</p>
                      <p>{configForm.watch('port')}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Dossier</p>
                      <p className="font-mono text-xs">/opt/ikoma/apps/{sourceForm.watch('app_name')}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-border p-4">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Terminal className="w-4 h-4" />
                    Étapes de déploiement ({generatedSteps.length})
                  </h4>
                  <div className="space-y-2">
                    {generatedSteps.map((step, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-2 rounded bg-muted/50">
                        <Badge variant="outline" className="shrink-0">{idx + 1}</Badge>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{step.step_name}</p>
                          <p className="text-xs text-muted-foreground font-mono truncate">
                            {step.command.length > 80 ? step.command.slice(0, 80) + '...' : step.command}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="flex justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={stepIndex === 0 || isSubmitting}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Retour
          </Button>

          {currentStep === 'preview' ? (
            <Button onClick={handleDeploy} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Création...
                </>
              ) : (
                <>
                  <Rocket className="w-4 h-4 mr-2" />
                  Créer le déploiement
                </>
              )}
            </Button>
          ) : (
            <Button onClick={handleNext} disabled={!canGoNext()}>
              Suivant
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
