import { useState, useMemo } from 'react';
import { 
  Copy, Check, AlertCircle, AlertTriangle, ShieldAlert, Eye, EyeOff, 
  RefreshCw, CheckCircle, XCircle, Loader2, Server, Zap, Terminal, 
  ChevronRight, ChevronDown, Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useApiUrls } from '@/hooks/useApiUrls';
import { useProxyRunners, useProxyCreateRunner, useProxyResetToken } from '@/hooks/useProxyRunners';
import { useTestRunnerAuth, useTestClaimNext } from '@/hooks/useRunnerAuthTest';
import { useInfrastructures } from '@/hooks/useInfrastructures';
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
  
  // Create runner dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newRunnerName, setNewRunnerName] = useState('');
  const [selectedInfraId, setSelectedInfraId] = useState<string>('none');

  // Hooks - Using secure proxy (no admin key in frontend)
  const { baseUrl, installScriptUrl, validateInstallUrl } = useApiUrls();
  const { data: runners, isLoading: runnersLoading, error: runnersError, refetch: refetchRunners } = useProxyRunners();
  const { data: infrastructures } = useInfrastructures();
  const createRunner = useProxyCreateRunner();
  const resetToken = useProxyResetToken();
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
      description: 'Sélectionnez ou créez un runner',
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

  // Handlers
  const handleSelectRunner = (runnerId: string) => {
    setSelectedRunnerId(runnerId);
    setToken('');
    setAuthTested(false);
    setAuthSuccess(false);
    setExpandedSteps(new Set([1, 2]));
  };

  const handleCreateRunner = async () => {
    if (!newRunnerName.trim()) return;
    
    try {
      const result = await createRunner.mutateAsync({
        name: newRunnerName.trim(),
        infrastructureId: selectedInfraId !== 'none' ? selectedInfraId : undefined,
      });
      
      // Auto-select the new runner and set token
      setSelectedRunnerId(result.id);
      setToken(result.token);
      setShowToken(true);
      setAuthTested(false);
      setAuthSuccess(false);
      setExpandedSteps(new Set([1, 2, 3]));
      
      // Reset dialog state
      setCreateDialogOpen(false);
      setNewRunnerName('');
      setSelectedInfraId('none');
      
      // Refresh runners list
      refetchRunners();
    } catch {
      // Error handled by mutation
    }
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

  // Calculate runner status badge variant
  const getStatusBadge = (status: string) => {
    const isOnline = status?.toLowerCase() === 'online';
    return (
      <Badge 
        variant="outline" 
        className={cn(
          "ml-2 text-xs",
          isOnline ? "border-green-500/50 text-green-500 bg-green-500/10" : "border-muted-foreground/50"
        )}
      >
        {isOnline ? '🟢' : '⚪'} {status}
      </Badge>
    );
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
      {/* Security notice */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20 text-primary">
        <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <p className="text-xs">
          Les tokens sont générés côté serveur et jamais exposés dans le navigateur.
        </p>
      </div>

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

      {/* Step 1: Select or Create Runner */}
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
              <h3 className="font-medium">1. Choisir ou créer runner</h3>
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
                  <SelectValue placeholder={runnersLoading ? "Chargement..." : "Sélectionner un runner existant"} />
                </SelectTrigger>
                <SelectContent>
                  {runners?.map((runner) => (
                    <SelectItem key={runner.id} value={runner.id}>
                      <div className="flex items-center gap-2">
                        <Server className="w-4 h-4" />
                        <span>{runner.name}</span>
                        {getStatusBadge(runner.status)}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" onClick={() => refetchRunners()} title="Actualiser la liste">
                <RefreshCw className={cn("w-4 h-4", runnersLoading && "animate-spin")} />
              </Button>
            </div>

            {/* Create Runner Dialog */}
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  Créer un nouveau runner
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Créer un runner</DialogTitle>
                  <DialogDescription>
                    Créez un nouveau runner et obtenez automatiquement son token d'authentification.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="runner-name">Nom du runner</Label>
                    <Input
                      id="runner-name"
                      value={newRunnerName}
                      onChange={(e) => setNewRunnerName(e.target.value)}
                      placeholder="ex: prod-server-1"
                      className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground">
                      Nom unique pour identifier ce runner
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="infra-select">Infrastructure (optionnel)</Label>
                    <Select value={selectedInfraId} onValueChange={setSelectedInfraId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Aucune infrastructure" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Aucune</SelectItem>
                        {infrastructures?.map((infra) => (
                          <SelectItem key={infra.id} value={infra.id}>
                            {infra.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Associer le runner à une infrastructure existante
                    </p>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                    Annuler
                  </Button>
                  <Button 
                    onClick={handleCreateRunner}
                    disabled={!newRunnerName.trim() || createRunner.isPending}
                  >
                    {createRunner.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Création...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-2" />
                        Créer et générer token
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            
            {runnersError && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <XCircle className="w-4 h-4" />
                <span>Erreur: {runnersError.message}</span>
              </div>
            )}

            {selectedRunnerId && (
              <div className="p-3 rounded-lg bg-muted/30 text-xs font-mono">
                <span className="text-muted-foreground">Runner ID:</span>{' '}
                <span className="text-foreground select-all">{selectedRunnerId}</span>
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
            {!token && (
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
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    Générer / Reset token
                  </>
                )}
              </Button>
            )}

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
                      title={showToken ? "Masquer" : "Afficher"}
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
                      title="Copier le token"
                    >
                      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                <Button 
                  onClick={handleResetToken}
                  disabled={resetToken.isPending}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  {resetToken.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Régénération...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Régénérer token
                    </>
                  )}
                </Button>
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
                title="Tester claim-next"
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
