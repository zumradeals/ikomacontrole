import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Rocket,
  GitBranch,
  Server,
  Settings,
  Eye,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Globe,
  Database,
  Terminal,
  Package,
  FileCode,
  Loader2,
  AlertTriangle,
  Plus,
  Copy,
  Sparkles,
  Search,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useRunners } from '@/hooks/useRunners';
import { useInfrastructures } from '@/hooks/useInfrastructures';
import { useCaddyRoutes, useAvailableCaddyRoutes, useCreateCaddyRoute, CaddyRoute } from '@/hooks/useCaddyRoutes';
import { useSupabaseInstance } from '@/hooks/usePlatformInstances';
import { useFrameworkDetection } from '@/hooks/useFrameworkDetection';
import {
  useCreateDeployment,
  useCreateDeploymentSteps,
  useUpdateDeployment,
  generateDeploymentSteps,
  DeploymentType,
  HealthcheckType,
  CreateDeploymentInput,
} from '@/hooks/useDeployments';
import { toast } from '@/hooks/use-toast';

// Schemas
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

const domainSchema = z.object({
  use_caddy: z.boolean(),
  route_id: z.string().optional(),
  new_subdomain: z.string().optional(),
});

const supabaseSchema = z.object({
  uses_supabase: z.boolean(),
  supabase_url: z.string().optional(),
  supabase_anon_key: z.string().optional(),
  import_from_platform: z.boolean(),
});

const configSchema = z.object({
  port: z.coerce.number().min(1).max(65535),
  start_command: z.string().optional(),
  healthcheck_type: z.enum(['http', 'tcp', 'command']),
  healthcheck_value: z.string().optional(),
});

type WizardStep = 'source' | 'target' | 'domain' | 'supabase' | 'config' | 'preview';

const STEPS: { key: WizardStep; label: string; icon: React.ReactNode }[] = [
  { key: 'source', label: 'Source', icon: <GitBranch className="w-4 h-4" /> },
  { key: 'target', label: 'Runner', icon: <Server className="w-4 h-4" /> },
  { key: 'domain', label: 'Domaine', icon: <Globe className="w-4 h-4" /> },
  { key: 'supabase', label: 'Supabase', icon: <Database className="w-4 h-4" /> },
  { key: 'config', label: 'Configuration', icon: <Settings className="w-4 h-4" /> },
  { key: 'preview', label: 'Prévisualisation', icon: <Eye className="w-4 h-4" /> },
];

const DEPLOY_TYPES: { value: DeploymentType; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: 'nodejs', label: 'Node.js', icon: <Package className="w-5 h-5" />, desc: 'Application Node.js/NPM' },
  { value: 'docker_compose', label: 'Docker Compose', icon: <Server className="w-5 h-5" />, desc: 'Stack Docker multi-container' },
  { value: 'static_site', label: 'Site Statique', icon: <FileCode className="w-5 h-5" />, desc: 'React, Vue, Angular build' },
];

const DeployerWizard = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<WizardStep>('source');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [envVars, setEnvVars] = useState<Record<string, string>>({});
  const [envVarsText, setEnvVarsText] = useState('');

  const { data: runners } = useRunners();
  const { data: infrastructures } = useInfrastructures();
  const createDeployment = useCreateDeployment();
  const createSteps = useCreateDeploymentSteps();
  const updateDeployment = useUpdateDeployment();
  const createRoute = useCreateCaddyRoute();
  
  // Framework detection
  const { 
    framework: detectedFramework, 
    isDetecting, 
    error: detectionError,
    rawFiles,
    detectFramework,
    reset: resetDetection,
  } = useFrameworkDetection();

  const onlineRunners = runners?.filter(r => r.status === 'online') || [];

  // Forms
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

  const domainForm = useForm<z.infer<typeof domainSchema>>({
    resolver: zodResolver(domainSchema),
    defaultValues: {
      use_caddy: true,
      route_id: '',
      new_subdomain: '',
    },
  });

  const supabaseForm = useForm<z.infer<typeof supabaseSchema>>({
    resolver: zodResolver(supabaseSchema),
    defaultValues: {
      uses_supabase: false,
      supabase_url: '',
      supabase_anon_key: '',
      import_from_platform: false,
    },
  });

  const configForm = useForm<z.infer<typeof configSchema>>({
    resolver: zodResolver(configSchema),
    defaultValues: {
      port: 3000,
      start_command: '',
      healthcheck_type: 'http',
      healthcheck_value: '/',
    },
  });

  // Watch repo URL changes for detection
  const repoUrl = sourceForm.watch('repo_url');
  const branch = sourceForm.watch('branch');

  // Handle framework detection
  const handleDetectFramework = useCallback(async () => {
    if (!repoUrl) return;
    await detectFramework(repoUrl, branch || 'main');
  }, [repoUrl, branch, detectFramework]);

  // Apply detected framework settings
  const handleApplyDetection = useCallback(() => {
    if (!detectedFramework) return;
    
    sourceForm.setValue('deploy_type', detectedFramework.type);
    configForm.setValue('port', detectedFramework.suggestedPort);
    if (detectedFramework.suggestedStartCommand) {
      configForm.setValue('start_command', detectedFramework.suggestedStartCommand);
    }
    
    toast({
      title: 'Configuration appliquée',
      description: `Type: ${detectedFramework.name}, Port: ${detectedFramework.suggestedPort}`,
    });
  }, [detectedFramework, sourceForm, configForm]);

  // Get selected runner's infrastructure
  const selectedRunnerId = targetForm.watch('runner_id');
  const selectedRunner = runners?.find(r => r.id === selectedRunnerId);
  const selectedInfrastructureId = selectedRunner?.infrastructure_id || undefined;
  const selectedInfra = infrastructures?.find(i => i.id === selectedInfrastructureId);

  // Get Caddy routes for selected infrastructure
  const { data: availableRoutes = [] } = useAvailableCaddyRoutes(selectedInfrastructureId);
  const { data: allRoutes = [] } = useCaddyRoutes(selectedInfrastructureId);

  // Get Supabase instance for auto-import
  const { data: supabaseInstance } = useSupabaseInstance(selectedInfrastructureId);

  // Get selected route
  const selectedRouteId = domainForm.watch('route_id');
  const selectedRoute = allRoutes.find(r => r.id === selectedRouteId);

  const stepIndex = STEPS.findIndex(s => s.key === currentStep);

  // Parse env vars from text
  const parseEnvVars = useCallback((text: string): Record<string, string> => {
    const vars: Record<string, string> = {};
    text.split('\n').forEach(line => {
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
  }, []);

  // Import Supabase credentials from Platform
  const handleImportSupabase = () => {
    if (!supabaseInstance) return;
    
    const deployType = sourceForm.watch('deploy_type');
    const isFrontend = deployType === 'static_site' || deployType === 'nodejs';
    
    // Map to correct env var names based on framework
    const prefix = isFrontend ? 'VITE_' : '';
    
    const imported: Record<string, string> = {
      [`${prefix}SUPABASE_URL`]: supabaseInstance.supabase_url || '',
      [`${prefix}SUPABASE_ANON_KEY`]: supabaseInstance.supabase_anon_key || '',
    };
    
    // Only add service role for backend
    if (!isFrontend && supabaseInstance.supabase_service_role_key) {
      imported['SUPABASE_SERVICE_ROLE_KEY'] = supabaseInstance.supabase_service_role_key;
    }
    
    setEnvVars(prev => ({ ...prev, ...imported }));
    supabaseForm.setValue('supabase_url', supabaseInstance.supabase_url || '');
    supabaseForm.setValue('supabase_anon_key', supabaseInstance.supabase_anon_key || '');
    supabaseForm.setValue('import_from_platform', true);
    
    toast({
      title: 'Credentials importés',
      description: 'Les variables Supabase ont été ajoutées',
    });
  };

  // Merge all env vars
  const getMergedEnvVars = useCallback((): Record<string, string> => {
    const manualVars = parseEnvVars(envVarsText);
    return { ...manualVars, ...envVars };
  }, [envVarsText, envVars, parseEnvVars]);

  // Validation
  const supabaseValidation = useMemo(() => {
    const usesSupabase = supabaseForm.watch('uses_supabase');
    if (!usesSupabase) return { isRequired: false, isValid: true, errors: [] };

    const deployType = sourceForm.watch('deploy_type');
    const isFrontend = deployType === 'static_site';
    const merged = getMergedEnvVars();
    const errors: string[] = [];

    // Check for Supabase URL
    const hasUrl = Object.keys(merged).some(k => 
      k.includes('SUPABASE_URL') && merged[k]
    );
    if (!hasUrl) errors.push('SUPABASE_URL manquant');

    // Check for Anon Key
    const hasAnonKey = Object.keys(merged).some(k => 
      k.includes('SUPABASE_ANON_KEY') && merged[k]
    );
    if (!hasAnonKey) errors.push('SUPABASE_ANON_KEY manquant');

    // Check for forbidden service role in frontend
    const hasServiceRole = Object.keys(merged).some(k => 
      k.includes('SERVICE_ROLE_KEY') && merged[k]
    );
    if (hasServiceRole && isFrontend) {
      errors.push('SERVICE_ROLE_KEY interdite dans build frontend');
    }

    return {
      isRequired: true,
      isValid: errors.length === 0,
      errors,
    };
  }, [supabaseForm.watch('uses_supabase'), sourceForm.watch('deploy_type'), getMergedEnvVars]);

  // Domain validation
  const domainValidation = useMemo(() => {
    const useCaddy = domainForm.watch('use_caddy');
    if (!useCaddy) return { isValid: true, errors: [] };

    const routeId = domainForm.watch('route_id');
    const route = allRoutes.find(r => r.id === routeId);
    const errors: string[] = [];

    if (!route) {
      errors.push('Aucun domaine sélectionné');
    } else if (route.https_status !== 'ok') {
      errors.push('HTTPS non configuré sur ce domaine');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }, [domainForm.watch('use_caddy'), domainForm.watch('route_id'), allRoutes]);

  // Navigation
  const handleNext = async () => {
    switch (currentStep) {
      case 'source':
        if (await sourceForm.trigger()) setCurrentStep('target');
        break;
      case 'target':
        if (await targetForm.trigger()) setCurrentStep('domain');
        break;
      case 'domain':
        setCurrentStep('supabase');
        break;
      case 'supabase':
        setCurrentStep('config');
        break;
      case 'config':
        if (await configForm.trigger()) setCurrentStep('preview');
        break;
    }
  };

  const handleBack = () => {
    const idx = stepIndex;
    if (idx > 0) setCurrentStep(STEPS[idx - 1].key);
  };

  // Get deployment input
  const getDeploymentInput = (): CreateDeploymentInput => {
    const source = sourceForm.getValues();
    const target = targetForm.getValues();
    const domain = domainForm.getValues();
    const config = configForm.getValues();

    return {
      app_name: source.app_name,
      repo_url: source.repo_url,
      branch: source.branch,
      deploy_type: source.deploy_type as DeploymentType,
      runner_id: target.runner_id,
      infrastructure_id: selectedInfrastructureId,
      port: config.port,
      start_command: config.start_command || undefined,
      healthcheck_type: config.healthcheck_type as HealthcheckType,
      healthcheck_value: config.healthcheck_value || '/',
      expose_via_caddy: domain.use_caddy,
      domain: selectedRoute?.full_domain || undefined,
      env_vars: getMergedEnvVars(),
    };
  };

  const generatedSteps = currentStep === 'preview' ? generateDeploymentSteps(getDeploymentInput()) : [];

  // Submit deployment
  const handleDeploy = async () => {
    // Final validation
    if (!domainValidation.isValid || !supabaseValidation.isValid) {
      toast({
        title: 'Validation échouée',
        description: 'Corrigez les erreurs avant de continuer',
        variant: 'destructive',
      });
      return;
    }

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

      toast({
        title: 'Déploiement créé',
        description: 'Redirection vers l\'exécution...',
      });

      navigate(`/deployer?run=${deployment.id}`);
    } catch (error) {
      console.error('Failed to create deployment:', error);
      toast({
        title: 'Erreur',
        description: 'Échec de la création du déploiement',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRunnerInfra = (runnerId: string) => {
    const runner = runners?.find(r => r.id === runnerId);
    if (!runner?.infrastructure_id) return null;
    return infrastructures?.find(i => i.id === runner.infrastructure_id);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <PageHeader
        title="Nouveau Déploiement"
        description="Configurez et déployez votre application en 6 étapes"
        icon={Rocket}
      />

      {/* Progress Steps */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between overflow-x-auto pb-2">
            {STEPS.map((step, idx) => (
              <div key={step.key} className="flex items-center flex-shrink-0">
                <button
                  onClick={() => idx <= stepIndex && setCurrentStep(step.key)}
                  disabled={idx > stepIndex}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    currentStep === step.key
                      ? 'bg-primary text-primary-foreground'
                      : stepIndex > idx
                        ? 'bg-green-500/20 text-green-500'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {stepIndex > idx ? <CheckCircle2 className="w-4 h-4" /> : step.icon}
                  <span className="hidden sm:inline">{step.label}</span>
                </button>
                {idx < STEPS.length - 1 && (
                  <div className={`w-8 h-0.5 mx-2 ${stepIndex > idx ? 'bg-green-500' : 'bg-muted'}`} />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Step 1: Source */}
      {currentStep === 'source' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="w-5 h-5" />
              Source Applicative
            </CardTitle>
            <CardDescription>
              Configurez le repository Git et le type de déploiement
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...sourceForm}>
              <form className="space-y-6">
                <FormField
                  control={sourceForm.control}
                  name="app_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nom de l'application</FormLabel>
                      <FormControl>
                        <Input placeholder="my-app" {...field} />
                      </FormControl>
                      <FormDescription>
                        Identifiant unique (lettres minuscules, chiffres, tirets)
                      </FormDescription>
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
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <GitBranch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input placeholder="https://github.com/user/repo.git" className="pl-10" {...field} />
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleDetectFramework}
                            disabled={!field.value || isDetecting}
                          >
                            {isDetecting ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Search className="w-4 h-4" />
                            )}
                            <span className="ml-2 hidden sm:inline">Détecter</span>
                          </Button>
                        </div>
                      </FormControl>
                      <FormDescription>
                        URL GitHub supportée pour la détection automatique
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Framework Detection Results */}
                {(detectedFramework || detectionError) && (
                  <div className="rounded-lg border p-4 bg-muted/30">
                    {detectionError ? (
                      <div className="flex items-center gap-2 text-amber-500">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="text-sm">{detectionError}</span>
                      </div>
                    ) : detectedFramework && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-primary" />
                            <span className="font-medium">Framework détecté</span>
                            <Badge 
                              variant={detectedFramework.confidence === 'high' ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {detectedFramework.confidence === 'high' ? 'Confiance élevée' : 
                               detectedFramework.confidence === 'medium' ? 'Confiance moyenne' : 'Confiance faible'}
                            </Badge>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleApplyDetection}
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1.5" />
                            Appliquer
                          </Button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Type:</span>{' '}
                            <span className="font-medium">{detectedFramework.name}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Déploiement:</span>{' '}
                            <Badge variant="outline" className="ml-1">
                              {detectedFramework.type}
                            </Badge>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Port suggéré:</span>{' '}
                            <span className="font-mono">{detectedFramework.suggestedPort}</span>
                          </div>
                          {detectedFramework.suggestedStartCommand && (
                            <div>
                              <span className="text-muted-foreground">Commande:</span>{' '}
                              <code className="text-xs bg-muted px-1 rounded">{detectedFramework.suggestedStartCommand}</code>
                            </div>
                          )}
                        </div>
                        
                        <div className="text-xs text-muted-foreground">
                          Fichiers détectés: {detectedFramework.detectedFiles.join(', ')}
                        </div>
                      </div>
                    )}
                  </div>
                )}

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
                      <FormDescription className="mb-3">
                        {detectedFramework && (
                          <span className="text-primary">
                            Suggestion basée sur la détection: {detectedFramework.type}
                          </span>
                        )}
                      </FormDescription>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {DEPLOY_TYPES.map(type => (
                          <button
                            key={type.value}
                            type="button"
                            onClick={() => field.onChange(type.value)}
                            className={`p-4 rounded-lg border text-left transition-all ${
                              field.value === type.value
                                ? 'border-primary bg-primary/10'
                                : 'border-border hover:border-primary/50'
                            } ${detectedFramework?.type === type.value && field.value !== type.value ? 'ring-1 ring-primary/30' : ''}`}
                          >
                            <div className="flex items-center gap-3 mb-2">
                              {type.icon}
                              <span className="font-medium">{type.label}</span>
                              {detectedFramework?.type === type.value && field.value !== type.value && (
                                <Badge variant="outline" className="text-xs ml-auto">Suggéré</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">{type.desc}</p>
                          </button>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Target */}
      {currentStep === 'target' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="w-5 h-5" />
              Cible de Déploiement
            </CardTitle>
            <CardDescription>
              Sélectionnez le runner et l'infrastructure de destination
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...targetForm}>
              <form className="space-y-6">
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

                {selectedInfra && (
                  <div className="rounded-lg border p-4 bg-muted/30">
                    <h4 className="font-medium mb-2">Infrastructure associée</h4>
                    <div className="text-sm space-y-1">
                      <p><span className="text-muted-foreground">Nom:</span> {selectedInfra.name}</p>
                      <p><span className="text-muted-foreground">Type:</span> {selectedInfra.type}</p>
                      {selectedInfra.os && <p><span className="text-muted-foreground">OS:</span> {selectedInfra.os}</p>}
                    </div>
                  </div>
                )}
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Domain & Routing */}
      {currentStep === 'domain' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              Domaine & Routage
            </CardTitle>
            <CardDescription>
              Configurez l'accès HTTPS via Caddy
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...domainForm}>
              <form className="space-y-6">
                <FormField
                  control={domainForm.control}
                  name="use_caddy"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Exposer via Caddy</FormLabel>
                        <FormDescription>
                          Configurer automatiquement un reverse proxy avec HTTPS
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {domainForm.watch('use_caddy') && (
                  <>
                    <FormField
                      control={domainForm.control}
                      name="route_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Domaine</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Sélectionner un domaine Caddy" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {availableRoutes.length === 0 ? (
                                <div className="p-4 text-center text-muted-foreground text-sm">
                                  Aucun domaine disponible
                                </div>
                              ) : (
                                availableRoutes.map(route => (
                                  <SelectItem key={route.id} value={route.id}>
                                    <div className="flex items-center gap-2">
                                      <Globe className="w-4 h-4" />
                                      <span>{route.full_domain}</span>
                                      {route.https_status === 'ok' && (
                                        <Badge variant="outline" className="text-green-500 border-green-500 text-xs">
                                          HTTPS
                                        </Badge>
                                      )}
                                    </div>
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {selectedRoute && (
                      <div className="rounded-lg border p-4 bg-muted/30 font-mono text-sm space-y-1">
                        <p>
                          <span className="text-muted-foreground">URL:</span>{' '}
                          <span className="text-primary">https://{selectedRoute.full_domain}</span>
                        </p>
                        <p>
                          <span className="text-muted-foreground">Backend:</span>{' '}
                          http://localhost:{configForm.watch('port')}
                        </p>
                        <p>
                          <span className="text-muted-foreground">HTTPS:</span>{' '}
                          <Badge variant={selectedRoute.https_status === 'ok' ? 'default' : 'destructive'}>
                            {selectedRoute.https_status}
                          </Badge>
                        </p>
                      </div>
                    )}

                    {!domainValidation.isValid && domainValidation.errors.length > 0 && (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Validation domaine</AlertTitle>
                        <AlertDescription>
                          {domainValidation.errors.join(', ')}
                        </AlertDescription>
                      </Alert>
                    )}
                  </>
                )}
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Supabase */}
      {currentStep === 'supabase' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Configuration Supabase
            </CardTitle>
            <CardDescription>
              Configurez les credentials Supabase si votre application en a besoin
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...supabaseForm}>
              <form className="space-y-6">
                <FormField
                  control={supabaseForm.control}
                  name="uses_supabase"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Cette app utilise Supabase</FormLabel>
                        <FormDescription>
                          Activer pour configurer les variables d'environnement Supabase
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {supabaseForm.watch('uses_supabase') && (
                  <>
                    {supabaseInstance && (
                      <Alert className="border-green-500/50 bg-green-500/10">
                        <Database className="h-4 w-4 text-green-500" />
                        <AlertTitle>Supabase détecté sur cette infrastructure</AlertTitle>
                        <AlertDescription className="flex items-center justify-between">
                          <span>{supabaseInstance.supabase_url}</span>
                          <Button size="sm" onClick={handleImportSupabase}>
                            Importer depuis Platform
                          </Button>
                        </AlertDescription>
                      </Alert>
                    )}

                    <Separator />

                    <div className="space-y-4">
                      <FormField
                        control={supabaseForm.control}
                        name="supabase_url"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Supabase URL</FormLabel>
                            <FormControl>
                              <Input placeholder="https://xxx.supabase.co" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={supabaseForm.control}
                        name="supabase_anon_key"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Supabase Anon Key</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {!supabaseValidation.isValid && supabaseValidation.errors.length > 0 && (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Validation Supabase</AlertTitle>
                        <AlertDescription>
                          <ul className="list-disc list-inside">
                            {supabaseValidation.errors.map((error, i) => (
                              <li key={i}>{error}</li>
                            ))}
                          </ul>
                        </AlertDescription>
                      </Alert>
                    )}
                  </>
                )}
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Configuration */}
      {currentStep === 'config' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Configuration Runtime
            </CardTitle>
            <CardDescription>
              Paramètres d'exécution et variables d'environnement
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...configForm}>
              <form className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                            : 'Port'}
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

                <div className="space-y-2">
                  <FormLabel>Variables d'environnement</FormLabel>
                  <Textarea
                    placeholder="KEY=value&#10;DATABASE_URL=postgres://..."
                    className="font-mono h-32"
                    value={envVarsText}
                    onChange={(e) => setEnvVarsText(e.target.value)}
                  />
                  <FormDescription>
                    Une variable par ligne (KEY=value). Les variables Supabase sont gérées dans l'étape précédente.
                  </FormDescription>
                </div>

                {Object.keys(getMergedEnvVars()).length > 0 && (
                  <div className="rounded-lg border p-4 bg-muted/30">
                    <p className="text-sm font-medium mb-2">
                      {Object.keys(getMergedEnvVars()).length} variable(s) configurée(s)
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {Object.keys(getMergedEnvVars()).map(key => (
                        <Badge key={key} variant="outline" className="font-mono text-xs">
                          {key}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Step 6: Preview */}
      {currentStep === 'preview' && (
        <div className="space-y-6">
          {/* Validation Summary */}
          <Card className={`${
            domainValidation.isValid && supabaseValidation.isValid
              ? 'border-green-500/50'
              : 'border-destructive/50'
          }`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {domainValidation.isValid && supabaseValidation.isValid ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : (
                  <XCircle className="w-5 h-5 text-destructive" />
                )}
                Vérification des prérequis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className={`p-3 rounded-lg border ${
                  domainValidation.isValid ? 'bg-green-500/5 border-green-500/30' : 'bg-red-500/5 border-red-500/30'
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    {domainValidation.isValid ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500" />
                    )}
                    <span className="font-medium text-sm">Domaine & HTTPS</span>
                  </div>
                  {!domainValidation.isValid && (
                    <p className="text-xs text-muted-foreground ml-6">
                      {domainValidation.errors.join(', ')}
                    </p>
                  )}
                </div>

                <div className={`p-3 rounded-lg border ${
                  supabaseValidation.isValid ? 'bg-green-500/5 border-green-500/30' : 'bg-red-500/5 border-red-500/30'
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    {supabaseValidation.isValid ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500" />
                    )}
                    <span className="font-medium text-sm">Variables Supabase</span>
                  </div>
                  {!supabaseValidation.isValid && (
                    <p className="text-xs text-muted-foreground ml-6">
                      {supabaseValidation.errors.join(', ')}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Deployment Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Résumé du déploiement</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Application</p>
                  <p className="font-mono font-medium">{sourceForm.watch('app_name')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Type</p>
                  <p>{DEPLOY_TYPES.find(t => t.value === sourceForm.watch('deploy_type'))?.label}</p>
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
                  <p className="text-muted-foreground">Domaine</p>
                  <p className="font-mono text-xs">
                    {selectedRoute?.full_domain || 'Non configuré'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Dossier</p>
                  <p className="font-mono text-xs">/opt/ikoma/apps/{sourceForm.watch('app_name')}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Environment Variables */}
          {Object.keys(getMergedEnvVars()).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Variables d'environnement ({Object.keys(getMergedEnvVars()).length})</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Variable</TableHead>
                      <TableHead>Valeur</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(getMergedEnvVars()).map(([key, value]) => (
                      <TableRow key={key}>
                        <TableCell className="font-mono text-sm">{key}</TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground">
                          {key.includes('KEY') || key.includes('SECRET') || key.includes('PASSWORD')
                            ? '••••••••'
                            : value.length > 50
                              ? value.slice(0, 50) + '...'
                              : value}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Deployment Steps */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Terminal className="w-5 h-5" />
                Étapes de déploiement ({generatedSteps.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {generatedSteps.map((step, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border">
                    <Badge variant="outline" className="shrink-0">{idx + 1}</Badge>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{step.step_name}</p>
                      <p className="text-xs text-muted-foreground font-mono truncate">
                        {step.command.length > 100 ? step.command.slice(0, 100) + '...' : step.command}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Navigation Footer */}
      <div className="fixed bottom-0 left-0 right-0 lg:left-60 bg-background/95 backdrop-blur border-t p-4">
        <div className="flex justify-between max-w-4xl mx-auto">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={stepIndex === 0 || isSubmitting}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Retour
          </Button>

          {currentStep === 'preview' ? (
            <Button
              onClick={handleDeploy}
              disabled={isSubmitting || !domainValidation.isValid || !supabaseValidation.isValid}
              size="lg"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Création...
                </>
              ) : (
                <>
                  <Rocket className="w-4 h-4 mr-2" />
                  Lancer le déploiement
                </>
              )}
            </Button>
          ) : (
            <Button onClick={handleNext}>
              Suivant
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeployerWizard;
