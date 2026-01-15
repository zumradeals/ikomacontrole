import { useState, useMemo } from 'react';
import { 
  Copy, Check, AlertCircle, AlertTriangle, ShieldAlert, Eye, EyeOff, 
  RefreshCw, CheckCircle, XCircle, Loader2, Server, Zap, Terminal, 
  ChevronRight, ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { useApiUrls } from '@/hooks/useApiUrls';
import { useExternalRunners, useResetRunnerToken, useTestRunnerAuth, useTestClaimNext } from '@/hooks/useExternalRunners';
import { useRunners } from '@/hooks/useRunners';
import { cn } from '@/lib/utils';

type Step = 1 | 2 | 3 | 4;

interface StepInfo {
  title: string;
  description: string;
  completed: boolean;
  current: boolean;
}

export function RunnerInstallWizard() {
  // State
  const [selectedRunnerId, setSelectedRunnerId] = useState<string>('');
  const [token, setToken] = useState<string>('');
  const [showToken, setShowToken] = useState(false);
  const [authTested, setAuthTested] = useState(false);
  const [authSuccess, setAuthSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Set<Step>>(new Set([1]));

  // Hooks
  const { baseUrl, installScriptUrl, validateInstallUrl, isLoading: urlsLoading } = useApiUrls();
  const { data: runners, isLoading: runnersLoading, error: runnersError, refetch: refetchRunners } = useRunners();
  const resetToken = useResetRunnerToken();
  const testAuth = useTestRunnerAuth();
  const testClaimNext = useTestClaimNext();

  // Selected runner info
  const selectedRunner = useMemo(() => 
    runners?.find(r => r.id === selectedRunnerId),
    [runners, selectedRunnerId]
  );

  // Install command
  const installCommand = useMemo(() => {
    if (!selectedRunnerId || !token || validateInstallUrl) return '';
    return `curl -sSL ${installScriptUrl} | bash -s -- --api-url ${baseUrl} --runner-id ${selectedRunnerId} --token ${token}`;
  }, [selectedRunnerId, token, validateInstallUrl, installScriptUrl, baseUrl]);

  // Steps state
  const steps: StepInfo[] = [
    {
      title: 'Choisir runner',
      description: 'Sélectionnez un runner dans la liste',
      completed: !!selectedRunnerId,
      current: !selectedRunnerId,
    },
    {
      title: 'Générer token',
      description: 'Obtenez un token d\'authentification',
      completed: !!token,
      current: !!selectedRunnerId && !token,
    },
    {
      title: 'Tester auth',
      description: 'Vérifiez la connexion',
      completed: authSuccess,
      current: !!token && !authSuccess,
    },
    {
      title: 'Copier commande',
      description: 'Installez sur le serveur',
      completed: false,
      current: authSuccess,
    },
  ];

  const currentStep = steps.findIndex(s => s.current) + 1 || 1;

  // Handlers
  const handleSelectRunner = (runnerId: string) => {
    setSelectedRunnerId(runnerId);
    setToken('');
    setAuthTested(false);
    setAuthSuccess(false);
    setExpandedSteps(new Set([1, 2]));
  };

  const handleResetToken = async () => {
    if (!selectedRunnerId) return;
    
    try {
      const result = await resetToken.mutateAsync(selectedRunnerId);
      setToken(result.token);
      setShowToken(true);
      setAuthTested(false);
      setAuthSuccess(false);
      setExpandedSteps(new Set([1, 2, 3]));
    } catch {
      // Error handled by mutation
    }
  };

  const handleTestAuth = async () => {
    if (!selectedRunnerId || !token) return;
    
    setAuthTested(true);
    const result = await testAuth.mutateAsync({ runnerId: selectedRunnerId, token });
    setAuthSuccess(result.success);
    if (result.success) {
      setExpandedSteps(new Set([1, 2, 3, 4]));
    }
  };

  const handleTestClaimNext = async () => {
    if (!selectedRunnerId || !token) return;
    await testClaimNext.mutateAsync({ runnerId: selectedRunnerId, token });
  };

  const handleCopy = async () => {
    if (installCommand) {
      await navigator.clipboard.writeText(installCommand);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const toggleStep = (step: Step) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(step)) {
        next.delete(step);
      } else {
        next.add(step);
      }
      return next;
    });
  };

  // URL validation error
  if (validateInstallUrl) {
    return (
      <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive">
        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium">Configuration invalide</p>
          <p className="text-xs opacity-80">{validateInstallUrl}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stepper header */}
      <div className="flex items-center gap-2 flex-wrap">
        {steps.map((step, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <div className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
              step.completed && "bg-green-500/20 text-green-400",
              step.current && !step.completed && "bg-primary/20 text-primary",
              !step.current && !step.completed && "bg-muted text-muted-foreground"
            )}>
              {step.completed ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <span className="w-5 h-5 rounded-full bg-current/20 flex items-center justify-center text-xs">
                  {idx + 1}
                </span>
              )}
              <span className="hidden sm:inline">{step.title}</span>
            </div>
            {idx < steps.length - 1 && (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Select Runner */}
      <div className="border border-border/50 rounded-lg overflow-hidden">
        <button
          onClick={() => toggleStep(1)}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            {selectedRunnerId ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <Server className="w-5 h-5 text-primary" />
            )}
            <div>
              <h3 className="font-medium">1. Choisir runner</h3>
              {selectedRunner && (
                <p className="text-sm text-muted-foreground">
                  {selectedRunner.name} ({selectedRunner.status})
                </p>
              )}
            </div>
          </div>
          {expandedSteps.has(1) ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
        </button>
        
        {expandedSteps.has(1) && (
          <div className="p-4 pt-0 space-y-3">
            <div className="flex items-center gap-2">
              <Select value={selectedRunnerId} onValueChange={handleSelectRunner}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder={runnersLoading ? "Chargement..." : "Sélectionner un runner"} />
                </SelectTrigger>
                <SelectContent>
                  {runners?.map((runner) => (
                    <SelectItem key={runner.id} value={runner.id}>
                      <div className="flex items-center gap-2">
                        <Server className="w-4 h-4" />
                        <span>{runner.name}</span>
                        <Badge variant="outline" className="ml-2 text-xs">
                          {runner.status}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" onClick={() => refetchRunners()}>
                <RefreshCw className={cn("w-4 h-4", runnersLoading && "animate-spin")} />
              </Button>
            </div>
            
            {runnersError && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <XCircle className="w-4 h-4" />
                <span>Erreur: {runnersError.message}</span>
              </div>
            )}

            {selectedRunnerId && (
              <div className="p-3 rounded-lg bg-muted/30 text-xs font-mono">
                <span className="text-muted-foreground">Runner ID:</span>{' '}
                <span className="text-foreground">{selectedRunnerId}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Step 2: Generate Token */}
      <div className="border border-border/50 rounded-lg overflow-hidden">
        <button
          onClick={() => toggleStep(2)}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/30 transition-colors"
          disabled={!selectedRunnerId}
        >
          <div className="flex items-center gap-3">
            {token ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <Zap className={cn("w-5 h-5", selectedRunnerId ? "text-primary" : "text-muted-foreground")} />
            )}
            <div>
              <h3 className={cn("font-medium", !selectedRunnerId && "text-muted-foreground")}>
                2. Générer token
              </h3>
              {token && (
                <p className="text-sm text-muted-foreground">Token généré ✓</p>
              )}
            </div>
          </div>
          {expandedSteps.has(2) ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
        </button>
        
        {expandedSteps.has(2) && selectedRunnerId && (
          <div className="p-4 pt-0 space-y-3">
            <Button 
              onClick={handleResetToken}
              disabled={resetToken.isPending}
              className="w-full"
            >
              {resetToken.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Génération...
                </>
              ) : token ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Régénérer token
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Générer token
                </>
              )}
            </Button>

            {resetToken.isError && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium">Endpoint non disponible</p>
                  <p className="text-xs opacity-80">
                    POST /v1/runners/{selectedRunnerId}/token/reset manquant côté serveur
                  </p>
                </div>
              </div>
            )}

            {token && (
              <>
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
                  <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <p className="font-medium">⚠️ Token visible une seule fois !</p>
                    <p>Copiez-le maintenant. Il ne sera plus affiché après rafraîchissement.</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Token d'authentification</Label>
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <div className="p-3 rounded-lg bg-muted/50 border border-border/50 font-mono text-sm break-all">
                        {showToken ? token : '•'.repeat(32)}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowToken(!showToken)}
                    >
                      {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        navigator.clipboard.writeText(token);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1000);
                      }}
                    >
                      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Step 3: Test Auth */}
      <div className="border border-border/50 rounded-lg overflow-hidden">
        <button
          onClick={() => toggleStep(3)}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/30 transition-colors"
          disabled={!token}
        >
          <div className="flex items-center gap-3">
            {authSuccess ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : authTested && !authSuccess ? (
              <XCircle className="w-5 h-5 text-destructive" />
            ) : (
              <Terminal className={cn("w-5 h-5", token ? "text-primary" : "text-muted-foreground")} />
            )}
            <div>
              <h3 className={cn("font-medium", !token && "text-muted-foreground")}>
                3. Tester auth
              </h3>
              {authTested && (
                <p className={cn(
                  "text-sm",
                  authSuccess ? "text-green-500" : "text-destructive"
                )}>
                  {authSuccess ? 'Authentification réussie ✓' : 'Échec authentification'}
                </p>
              )}
            </div>
          </div>
          {expandedSteps.has(3) ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
        </button>
        
        {expandedSteps.has(3) && token && (
          <div className="p-4 pt-0 space-y-3">
            <div className="flex gap-2">
              <Button 
                onClick={handleTestAuth}
                disabled={testAuth.isPending}
                className="flex-1"
                variant={authSuccess ? "outline" : "default"}
              >
                {testAuth.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Test en cours...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    Tester heartbeat
                  </>
                )}
              </Button>
              
              <Button 
                onClick={handleTestClaimNext}
                disabled={testClaimNext.isPending || !authSuccess}
                variant="outline"
              >
                {testClaimNext.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'claim-next'
                )}
              </Button>
            </div>

            {testAuth.data && (
              <div className={cn(
                "flex items-center gap-2 p-3 rounded-lg text-sm",
                testAuth.data.success 
                  ? "bg-green-500/10 border border-green-500/30 text-green-500" 
                  : "bg-destructive/10 border border-destructive/30 text-destructive"
              )}>
                {testAuth.data.success ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )}
                <span>{testAuth.data.message}</span>
                <span className="text-xs opacity-60">(HTTP {testAuth.data.status})</span>
              </div>
            )}

            {testClaimNext.data && (
              <div className={cn(
                "flex items-center gap-2 p-3 rounded-lg text-sm",
                testClaimNext.data.success 
                  ? "bg-green-500/10 border border-green-500/30 text-green-500" 
                  : "bg-destructive/10 border border-destructive/30 text-destructive"
              )}>
                {testClaimNext.data.success ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )}
                <span>{testClaimNext.data.message}</span>
                <span className="text-xs opacity-60">(HTTP {testClaimNext.data.status})</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Step 4: Install Command */}
      <div className="border border-border/50 rounded-lg overflow-hidden">
        <button
          onClick={() => toggleStep(4)}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/30 transition-colors"
          disabled={!authSuccess}
        >
          <div className="flex items-center gap-3">
            <Terminal className={cn("w-5 h-5", authSuccess ? "text-primary" : "text-muted-foreground")} />
            <div>
              <h3 className={cn("font-medium", !authSuccess && "text-muted-foreground")}>
                4. Commande d'installation
              </h3>
              {authSuccess && (
                <p className="text-sm text-muted-foreground">Prêt à installer</p>
              )}
            </div>
          </div>
          {expandedSteps.has(4) ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
        </button>
        
        {expandedSteps.has(4) && authSuccess && (
          <div className="p-4 pt-0 space-y-3">
            <div className="flex items-center justify-between">
              <Label>Commande à exécuter en root</Label>
              <Button onClick={handleCopy} size="sm">
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-1" />
                    Copié !
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-1" />
                    Copier
                  </>
                )}
              </Button>
            </div>
            
            <pre className="p-4 rounded-lg bg-muted/50 border border-border/50 overflow-x-auto">
              <code className="text-sm font-mono text-foreground break-all whitespace-pre-wrap">
                {installCommand}
              </code>
            </pre>
            
            <p className="text-xs text-muted-foreground">
              Exécutez cette commande <strong>en tant que root</strong> sur votre serveur.
              Le runner s'enregistrera automatiquement.
            </p>
          </div>
        )}

        {!authSuccess && token && (
          <div className="p-4 pt-0">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <p className="text-sm">Testez l'authentification avant d'afficher la commande.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
