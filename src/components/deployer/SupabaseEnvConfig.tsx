import { useState, useMemo } from 'react';
import { 
  Database, 
  Download, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  Eye,
  EyeOff,
  Shield,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { usePlatformServices } from '@/hooks/usePlatformServices';

// Framework detection patterns
export type FrameworkType = 'vite' | 'nextjs' | 'node' | 'unknown';

const FRAMEWORK_ENV_MAPPING: Record<FrameworkType, {
  url: string;
  anonKey: string;
  serviceRole?: string;
}> = {
  vite: {
    url: 'VITE_SUPABASE_URL',
    anonKey: 'VITE_SUPABASE_ANON_KEY',
  },
  nextjs: {
    url: 'NEXT_PUBLIC_SUPABASE_URL',
    anonKey: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    serviceRole: 'SUPABASE_SERVICE_ROLE_KEY',
  },
  node: {
    url: 'SUPABASE_URL',
    anonKey: 'SUPABASE_ANON_KEY',
    serviceRole: 'SUPABASE_SERVICE_ROLE_KEY',
  },
  unknown: {
    url: 'SUPABASE_URL',
    anonKey: 'SUPABASE_ANON_KEY',
  },
};

export interface SupabaseCredentials {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
}

export interface SupabaseEnvConfigProps {
  deployType: 'nodejs' | 'docker_compose' | 'static_site' | 'custom';
  framework: FrameworkType;
  infrastructureId?: string;
  onCredentialsChange: (credentials: SupabaseCredentials | null) => void;
  credentials: SupabaseCredentials | null;
  envVars: Record<string, string>;
  onEnvVarsChange: (vars: Record<string, string>) => void;
}

export function SupabaseEnvConfig({
  deployType,
  framework,
  infrastructureId,
  onCredentialsChange,
  credentials,
  envVars,
  onEnvVarsChange,
}: SupabaseEnvConfigProps) {
  const [isSupabaseProject, setIsSupabaseProject] = useState(true);
  const [showServiceRoleKey, setShowServiceRoleKey] = useState(false);
  const [showAnonKey, setShowAnonKey] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Get Platform services for the selected infrastructure
  const { services, gating } = usePlatformServices(infrastructureId);
  
  // Check if Supabase is installed on Platform
  const supabaseService = services.find(s => s.id === 'supabase');
  const supabaseInstalled = supabaseService?.status === 'installed';

  // Is this a frontend build (dangerous for service role key)?
  const isFrontendBuild = deployType === 'static_site' || 
    framework === 'vite' || 
    (framework === 'nextjs' && deployType !== 'docker_compose');

  // Current env mapping based on framework
  const envMapping = FRAMEWORK_ENV_MAPPING[framework];

  // Validation state
  const validation = useMemo(() => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (isSupabaseProject) {
      if (!credentials?.url) {
        errors.push('SUPABASE_URL est requis');
      } else if (!credentials.url.startsWith('https://')) {
        errors.push('SUPABASE_URL doit commencer par https://');
      }

      if (!credentials?.anonKey) {
        errors.push('SUPABASE_ANON_KEY est requis');
      } else if (credentials.anonKey.length < 100) {
        warnings.push('SUPABASE_ANON_KEY semble invalide (trop court)');
      }

      if (credentials?.serviceRoleKey && isFrontendBuild) {
        errors.push('SERVICE_ROLE_KEY est interdite dans un build frontend');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }, [credentials, isSupabaseProject, isFrontendBuild]);

  // Handle import from Platform
  const handleImportFromPlatform = async () => {
    setIsImporting(true);
    try {
      // TODO: In a real implementation, this would fetch from the platform_instances table
      // For now, we'll simulate getting credentials from Platform
      // The actual implementation would query the Supabase instance configuration stored in DB
      
      // Simulated platform data - in reality this comes from platform_instances or settings table
      const platformSupabase = {
        url: infrastructureId ? `https://${infrastructureId.slice(0, 8)}.supabase.local` : '',
        anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1sb2NhbCIsInJvbGUiOiJhbm9uIn0.placeholder',
        serviceRoleKey: !isFrontendBuild ? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1sb2NhbCIsInJvbGUiOiJzZXJ2aWNlX3JvbGUifQ.placeholder' : undefined,
      };

      onCredentialsChange(platformSupabase);
      
      // Auto-map to env vars
      const newEnvVars = { ...envVars };
      newEnvVars[envMapping.url] = platformSupabase.url;
      newEnvVars[envMapping.anonKey] = platformSupabase.anonKey;
      if (platformSupabase.serviceRoleKey && envMapping.serviceRole && !isFrontendBuild) {
        newEnvVars[envMapping.serviceRole] = platformSupabase.serviceRoleKey;
      }
      onEnvVarsChange(newEnvVars);

      toast.success('Credentials Supabase importés depuis Platform');
    } catch (error) {
      toast.error('Erreur lors de l\'import depuis Platform');
    } finally {
      setIsImporting(false);
    }
  };

  // Handle manual credential change
  const handleCredentialChange = (field: keyof SupabaseCredentials, value: string) => {
    const newCredentials = {
      url: credentials?.url || '',
      anonKey: credentials?.anonKey || '',
      serviceRoleKey: credentials?.serviceRoleKey,
      [field]: value,
    };
    
    onCredentialsChange(newCredentials);

    // Auto-map to env vars
    const newEnvVars = { ...envVars };
    if (field === 'url') {
      newEnvVars[envMapping.url] = value;
    } else if (field === 'anonKey') {
      newEnvVars[envMapping.anonKey] = value;
    } else if (field === 'serviceRoleKey' && envMapping.serviceRole && !isFrontendBuild) {
      newEnvVars[envMapping.serviceRole] = value;
    }
    onEnvVarsChange(newEnvVars);
  };

  // Mask key for display
  const maskKey = (key: string) => {
    if (!key || key.length < 20) return key;
    return `${key.slice(0, 10)}...${key.slice(-4)}`;
  };

  return (
    <div className="space-y-4 rounded-lg border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-primary" />
          <h4 className="font-medium">Configuration Supabase</h4>
          <Badge variant="outline" className="text-xs">
            {framework.toUpperCase()}
          </Badge>
        </div>
        <Switch
          checked={isSupabaseProject}
          onCheckedChange={(checked) => {
            setIsSupabaseProject(checked);
            if (!checked) {
              onCredentialsChange(null);
            }
          }}
        />
      </div>

      {isSupabaseProject && (
        <div className="space-y-4">
          {/* Auto-import from Platform */}
          {supabaseInstalled && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/10 border border-green-500/30">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="text-sm">Supabase installé sur cette infrastructure</span>
              </div>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={handleImportFromPlatform}
                disabled={isImporting}
              >
                {isImporting ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-1" />
                )}
                Importer depuis Platform
              </Button>
            </div>
          )}

          {!supabaseInstalled && gating.hasInfra && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted text-sm text-muted-foreground">
              <AlertTriangle className="w-4 h-4" />
              <span>Supabase n'est pas installé sur cette infrastructure. Saisissez les credentials manuellement.</span>
            </div>
          )}

          {/* Manual credential input */}
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>
                Supabase URL <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="https://your-project.supabase.co"
                value={credentials?.url || ''}
                onChange={(e) => handleCredentialChange('url', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Sera mappé vers: <code className="bg-muted px-1 rounded">{envMapping.url}</code>
              </p>
            </div>

            <div className="space-y-2">
              <Label>
                Anon Key <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  type={showAnonKey ? 'text' : 'password'}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={credentials?.anonKey || ''}
                  onChange={(e) => handleCredentialChange('anonKey', e.target.value)}
                  className="pr-10 font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setShowAnonKey(!showAnonKey)}
                >
                  {showAnonKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Sera mappé vers: <code className="bg-muted px-1 rounded">{envMapping.anonKey}</code>
              </p>
            </div>

            {/* Service Role Key - only for backend */}
            {!isFrontendBuild && (
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground">
                    <Shield className="w-4 h-4" />
                    Service Role Key (optionnel, backend uniquement)
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2">
                  <div className="space-y-2 p-3 rounded-lg border border-orange-500/30 bg-orange-500/5">
                    <div className="flex items-center gap-2 text-sm text-orange-500">
                      <AlertTriangle className="w-4 h-4" />
                      <span>⚠️ Clé secrète - Ne jamais exposer côté client</span>
                    </div>
                    <div className="relative">
                      <Input
                        type={showServiceRoleKey ? 'text' : 'password'}
                        placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                        value={credentials?.serviceRoleKey || ''}
                        onChange={(e) => handleCredentialChange('serviceRoleKey', e.target.value)}
                        className="pr-10 font-mono text-xs"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                        onClick={() => setShowServiceRoleKey(!showServiceRoleKey)}
                      >
                        {showServiceRoleKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                    {envMapping.serviceRole && (
                      <p className="text-xs text-muted-foreground">
                        Sera mappé vers: <code className="bg-muted px-1 rounded">{envMapping.serviceRole}</code>
                      </p>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {isFrontendBuild && credentials?.serviceRoleKey && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive">
                <XCircle className="w-4 h-4 shrink-0" />
                <span>
                  <strong>Interdit:</strong> La SERVICE_ROLE_KEY ne peut pas être injectée dans un build frontend ({framework}).
                </span>
              </div>
            )}
          </div>

          {/* Validation summary */}
          <div className="rounded-lg border p-3 space-y-2">
            <h5 className="text-sm font-medium">Vérification des credentials</h5>
            
            {validation.errors.map((error, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-destructive">
                <XCircle className="w-4 h-4" />
                <span>{error}</span>
              </div>
            ))}

            {validation.warnings.map((warning, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-yellow-500">
                <AlertTriangle className="w-4 h-4" />
                <span>{warning}</span>
              </div>
            ))}

            {validation.isValid && credentials?.url && credentials?.anonKey && (
              <div className="flex items-center gap-2 text-sm text-green-500">
                <CheckCircle2 className="w-4 h-4" />
                <span>Credentials Supabase valides</span>
              </div>
            )}
          </div>

          {/* Preview of generated env vars */}
          {credentials?.url && credentials?.anonKey && (
            <div className="rounded-lg bg-muted p-3">
              <h5 className="text-sm font-medium mb-2">Variables générées</h5>
              <div className="space-y-1 font-mono text-xs">
                <p>
                  <span className="text-muted-foreground">{envMapping.url}=</span>
                  <span className="text-primary">{credentials.url}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">{envMapping.anonKey}=</span>
                  <span className="text-primary">{maskKey(credentials.anonKey)}</span>
                </p>
                {credentials.serviceRoleKey && envMapping.serviceRole && !isFrontendBuild && (
                  <p>
                    <span className="text-muted-foreground">{envMapping.serviceRole}=</span>
                    <span className="text-orange-500">{maskKey(credentials.serviceRoleKey)}</span>
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Utility to detect framework from repository (simplified)
export function detectFramework(deployType: string): FrameworkType {
  // In a real implementation, this would analyze package.json from the repo
  // For now, we use simple heuristics
  switch (deployType) {
    case 'static_site':
      return 'vite'; // Most static sites are Vite-based
    case 'nodejs':
      return 'node';
    case 'docker_compose':
      return 'node'; // Could be anything, default to node
    default:
      return 'unknown';
  }
}

// Check if env vars contain Supabase-related keys
export function hasSupabaseEnvVars(envVars: Record<string, string>): boolean {
  const supabaseKeys = [
    'SUPABASE_URL', 'VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ];
  return Object.keys(envVars).some(key => supabaseKeys.includes(key));
}
