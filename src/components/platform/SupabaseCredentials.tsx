import { useState, useCallback } from 'react';
import { 
  Eye, 
  EyeOff, 
  Copy, 
  Check, 
  Shield, 
  Key,
  Globe,
  Database,
  Lock,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from '@/hooks/use-toast';

export interface SupabaseCredentialsData {
  supabase_url?: string | null;
  supabase_anon_key?: string | null;
  supabase_service_role_key?: string | null;
  supabase_jwt_secret?: string | null;
  supabase_postgres_password?: string | null;
  studio_url?: string;
  api_url?: string;
}

interface CredentialFieldProps {
  label: string;
  value: string | null | undefined;
  icon: React.ReactNode;
  sensitive?: boolean;
  description?: string;
  badge?: { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' };
}

function CredentialField({ 
  label, 
  value, 
  icon, 
  sensitive = false, 
  description,
  badge,
}: CredentialFieldProps) {
  const [isRevealed, setIsRevealed] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!value) return;
    
    try {
      await navigator.clipboard.writeText(value);
      setIsCopied(true);
      toast({
        title: 'Copié',
        description: `${label} copié dans le presse-papiers`,
      });
      
      // Reset after 2 seconds
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de copier dans le presse-papiers',
        variant: 'destructive',
      });
    }
  }, [value, label]);

  const handleReveal = useCallback(() => {
    setIsRevealed(prev => !prev);
    
    // Auto-hide after 10 seconds for security
    if (!isRevealed) {
      setTimeout(() => setIsRevealed(false), 10000);
    }
  }, [isRevealed]);

  const getMaskedValue = (val: string): string => {
    if (val.length <= 8) return '••••••••';
    return val.slice(0, 4) + '••••••••••••' + val.slice(-4);
  };

  const displayValue = !value 
    ? '—' 
    : (sensitive && !isRevealed) 
      ? getMaskedValue(value) 
      : value;

  const isEmpty = !value;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{icon}</span>
          <span className="font-medium text-sm">{label}</span>
          {badge && (
            <Badge variant={badge.variant} className="text-xs">
              {badge.label}
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          {sensitive && !isEmpty && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={handleReveal}
                  >
                    {isRevealed ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isRevealed ? 'Masquer' : 'Révéler (10s)'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          {!isEmpty && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={handleCopy}
                  >
                    {isCopied ? (
                      <Check className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isCopied ? 'Copié !' : 'Copier'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>
      
      <div className={`
        font-mono text-xs p-2.5 rounded-md break-all
        ${isEmpty 
          ? 'bg-muted/30 text-muted-foreground italic' 
          : 'bg-muted/50 text-foreground'
        }
        ${sensitive && !isRevealed && !isEmpty ? 'tracking-wider' : ''}
      `}>
        {displayValue}
      </div>
      
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  );
}

interface SupabaseCredentialsProps {
  credentials: SupabaseCredentialsData;
  showSecurityWarning?: boolean;
  compact?: boolean;
}

export function SupabaseCredentials({ 
  credentials, 
  showSecurityWarning = true,
  compact = false,
}: SupabaseCredentialsProps) {
  const hasAnyCredential = Object.values(credentials).some(v => v);

  if (!hasAnyCredential) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-6 text-center">
          <Database className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">
            Aucun credential Supabase disponible
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className={compact ? 'pb-3' : ''}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Credentials Supabase</CardTitle>
          </div>
          <Badge variant="outline" className="text-xs">
            <Lock className="w-3 h-3 mr-1" />
            Sécurisé
          </Badge>
        </div>
        <CardDescription>
          Gardez ces informations confidentielles. Ne les partagez jamais publiquement.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {showSecurityWarning && (
          <Alert className="bg-amber-500/10 border-amber-500/30">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <AlertDescription className="text-amber-200 text-sm">
              <strong>Sécurité :</strong> Les clés sensibles sont masquées par défaut. 
              Évitez d'exposer la <code className="bg-muted px-1 rounded">SERVICE_ROLE_KEY</code> côté client.
            </AlertDescription>
          </Alert>
        )}

        {/* Public URLs */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            URLs Publiques
          </h4>
          
          <CredentialField
            label="Supabase URL"
            value={credentials.supabase_url}
            icon={<Globe className="w-4 h-4" />}
            description="URL de l'API Supabase (public)"
          />
          
          {credentials.studio_url && (
            <div className="flex items-center gap-2">
              <CredentialField
                label="Studio URL"
                value={credentials.studio_url}
                icon={<ExternalLink className="w-4 h-4" />}
                description="Interface d'administration"
              />
            </div>
          )}
        </div>

        <Separator />

        {/* API Keys */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Clés API
          </h4>
          
          <CredentialField
            label="Anon Key"
            value={credentials.supabase_anon_key}
            icon={<Key className="w-4 h-4" />}
            sensitive
            badge={{ label: 'Public', variant: 'secondary' }}
            description="Clé publique pour les requêtes client (respecte RLS)"
          />
          
          <CredentialField
            label="Service Role Key"
            value={credentials.supabase_service_role_key}
            icon={<Key className="w-4 h-4" />}
            sensitive
            badge={{ label: 'Secret', variant: 'destructive' }}
            description="Clé admin bypass RLS - NE JAMAIS exposer côté client"
          />
        </div>

        <Separator />

        {/* Secrets */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Secrets Internes
          </h4>
          
          <CredentialField
            label="JWT Secret"
            value={credentials.supabase_jwt_secret}
            icon={<Lock className="w-4 h-4" />}
            sensitive
            badge={{ label: 'Secret', variant: 'destructive' }}
            description="Secret pour la signature des tokens JWT"
          />
          
          <CredentialField
            label="Postgres Password"
            value={credentials.supabase_postgres_password}
            icon={<Database className="w-4 h-4" />}
            sensitive
            badge={{ label: 'Secret', variant: 'destructive' }}
            description="Mot de passe PostgreSQL"
          />
        </div>

        {/* Quick copy actions */}
        <Separator />
        
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Export Rapide
          </h4>
          <div className="flex flex-wrap gap-2">
            <QuickCopyButton
              label="Copier .env Frontend"
              onClick={() => {
                const env = [
                  credentials.supabase_url && `VITE_SUPABASE_URL=${credentials.supabase_url}`,
                  credentials.supabase_anon_key && `VITE_SUPABASE_ANON_KEY=${credentials.supabase_anon_key}`,
                ].filter(Boolean).join('\n');
                navigator.clipboard.writeText(env);
                toast({ title: 'Variables frontend copiées' });
              }}
            />
            <QuickCopyButton
              label="Copier .env Backend"
              onClick={() => {
                const env = [
                  credentials.supabase_url && `SUPABASE_URL=${credentials.supabase_url}`,
                  credentials.supabase_anon_key && `SUPABASE_ANON_KEY=${credentials.supabase_anon_key}`,
                  credentials.supabase_service_role_key && `SUPABASE_SERVICE_ROLE_KEY=${credentials.supabase_service_role_key}`,
                  credentials.supabase_jwt_secret && `JWT_SECRET=${credentials.supabase_jwt_secret}`,
                ].filter(Boolean).join('\n');
                navigator.clipboard.writeText(env);
                toast({ title: 'Variables backend copiées' });
              }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickCopyButton({ label, onClick }: { label: string; onClick: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleClick = () => {
    onClick();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      className="text-xs"
    >
      {copied ? (
        <Check className="w-3 h-3 mr-1.5 text-green-500" />
      ) : (
        <Copy className="w-3 h-3 mr-1.5" />
      )}
      {label}
    </Button>
  );
}

// Compact inline display for smaller spaces
export function SupabaseCredentialsInline({ 
  credentials 
}: { 
  credentials: SupabaseCredentialsData 
}) {
  const [copied, setCopied] = useState<string | null>(null);

  const copyValue = async (key: string, value: string | null | undefined) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const items = [
    { key: 'url', label: 'URL', value: credentials.supabase_url },
    { key: 'anon', label: 'Anon', value: credentials.supabase_anon_key },
    { key: 'service', label: 'Service', value: credentials.supabase_service_role_key },
  ].filter(item => item.value);

  return (
    <div className="flex flex-wrap gap-2">
      {items.map(item => (
        <TooltipProvider key={item.key}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => copyValue(item.key, item.value)}
              >
                {copied === item.key ? (
                  <Check className="w-3 h-3 mr-1 text-green-500" />
                ) : (
                  <Copy className="w-3 h-3 mr-1" />
                )}
                {item.label}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-mono text-xs max-w-xs truncate">{item.value}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ))}
    </div>
  );
}
