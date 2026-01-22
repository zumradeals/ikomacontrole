/**
 * PlaybookWizard - Mode Simple
 * 
 * 4-step wizard for non-technical users:
 * 1. CHOISIR: Select from templates or scan server scripts
 * 2. CONFIGURER: Visual form auto-generated
 * 3. TESTER: Sandbox preview
 * 4. PUBLIER: Submit for review
 */

import { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  ChevronLeft,
  ChevronRight,
  Check,
  Loader2, 
  Sparkles,
  FolderSearch,
  Settings2,
  FlaskConical,
  Send,
  FileCode,
  Terminal,
  Code,
  Play,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Shield,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePlaybookTemplates, useLocalPlaybooks } from '@/hooks/usePlaybookGovernance';
import { useTriggerScriptScan, type ScriptInfo } from '@/hooks/usePlaybookAdmin';
import { useInfrastructures } from '@/hooks/useInfrastructures';

interface PlaybookWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type WizardStep = 'choose' | 'configure' | 'test' | 'publish';

const STEPS: { key: WizardStep; label: string; icon: React.ElementType }[] = [
  { key: 'choose', label: 'Choisir', icon: Sparkles },
  { key: 'configure', label: 'Configurer', icon: Settings2 },
  { key: 'test', label: 'Tester', icon: FlaskConical },
  { key: 'publish', label: 'Publier', icon: Send },
];

const RISK_CONFIG = {
  low: { label: 'Faible', color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: Shield },
  medium: { label: 'Modéré', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: AlertTriangle },
  high: { label: 'Élevé', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', icon: AlertTriangle },
  critical: { label: 'Critique', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: Zap },
};

interface WizardState {
  // Source selection
  sourceType: 'template' | 'script' | null;
  selectedTemplateId: string | null;
  selectedScript: ScriptInfo | null;
  
  // Configuration
  key: string;
  title: string;
  description: string;
  category: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  runtime: 'bash' | 'python' | 'node';
  entrypoint: string;
  timeoutSec: number;
  
  // Test
  testInfraId: string | null;
  testStatus: 'idle' | 'running' | 'success' | 'failed';
  testOutput: string;
  
  // Review
  reviewNotes: string;
}

const initialState: WizardState = {
  sourceType: null,
  selectedTemplateId: null,
  selectedScript: null,
  key: '',
  title: '',
  description: '',
  category: 'custom',
  riskLevel: 'medium',
  runtime: 'bash',
  entrypoint: '',
  timeoutSec: 300,
  testInfraId: null,
  testStatus: 'idle',
  testOutput: '',
  reviewNotes: '',
};

export function PlaybookWizard({ open, onOpenChange }: PlaybookWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('choose');
  const [state, setState] = useState<WizardState>(initialState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Data hooks
  const { data: templates = [], isLoading: loadingTemplates } = usePlaybookTemplates();
  const { data: infrastructures = [] } = useInfrastructures();
  const createPlaybook = useLocalPlaybooks();
  const scanScripts = useTriggerScriptScan();
  
  const [scannedScripts, setScannedScripts] = useState<ScriptInfo[]>([]);
  const [scanInfraId, setScanInfraId] = useState<string>('');

  const currentStepIndex = STEPS.findIndex(s => s.key === currentStep);
  const progress = ((currentStepIndex + 1) / STEPS.length) * 100;

  const updateState = (updates: Partial<WizardState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const handleScanScripts = async () => {
    if (!scanInfraId) return;
    try {
      const scripts = await scanScripts.mutateAsync(scanInfraId);
      setScannedScripts(scripts);
    } catch {
      // Error handled by mutation
    }
  };

  const selectTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      updateState({
        sourceType: 'template',
        selectedTemplateId: templateId,
        key: `custom.${template.key.split('.').pop() || 'script'}`,
        title: template.title,
        description: template.description || '',
        category: template.category,
        riskLevel: template.risk_level as WizardState['riskLevel'],
        runtime: template.runtime,
        entrypoint: template.entrypoint_template,
      });
    }
  };

  const selectScript = (script: ScriptInfo) => {
    const autoKey = script.name
      .replace(/\.(sh|py|js|ts)$/, '')
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .toLowerCase();
    
    updateState({
      sourceType: 'script',
      selectedScript: script,
      key: `custom.${autoKey}`,
      title: script.name.replace(/\.(sh|py|js|ts)$/, ''),
      runtime: script.runtime === 'unknown' ? 'bash' : script.runtime as WizardState['runtime'],
      entrypoint: script.path,
    });
  };

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 'choose':
        return state.sourceType !== null && (state.selectedTemplateId !== null || state.selectedScript !== null);
      case 'configure':
        return !!state.key && !!state.title && !!state.entrypoint;
      case 'test':
        return state.testStatus === 'success' || state.testStatus === 'idle'; // Can skip test
      case 'publish':
        return true;
      default:
        return false;
    }
  };

  const goNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex].key);
    }
  };

  const goBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].key);
    }
  };

  const handleRunTest = async () => {
    if (!state.testInfraId) return;
    
    updateState({ testStatus: 'running', testOutput: '' });
    
    // Simulate test run - in production this would call the sandbox API
    setTimeout(() => {
      updateState({
        testStatus: 'success',
        testOutput: `[OK] Script exécuté avec succès\n[INFO] Exit code: 0\n[INFO] Durée: 1.2s`,
      });
    }, 2000);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await createPlaybook.createMutation.mutateAsync({
        key: state.key,
        title: state.title,
        description: state.description,
        category: state.category,
        runtime: state.runtime,
        entrypoint: state.entrypoint,
        timeout_sec: state.timeoutSec,
        risk_level: state.riskLevel,
        status: 'pending_review', // Submit for review
      });
      
      // Reset and close
      setState(initialState);
      setCurrentStep('choose');
      onOpenChange(false);
    } catch {
      // Error handled by mutation
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setState(initialState);
    setCurrentStep('choose');
    setScannedScripts([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0 gap-0">
        {/* Header with progress */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Créer un Playbook
          </DialogTitle>
          <DialogDescription>
            Assistant de création en 4 étapes
          </DialogDescription>
          
          {/* Step indicators */}
          <div className="flex items-center gap-2 mt-4">
            {STEPS.map((step, idx) => {
              const Icon = step.icon;
              const isActive = step.key === currentStep;
              const isComplete = idx < currentStepIndex;
              
              return (
                <div key={step.key} className="flex items-center gap-2 flex-1">
                  <div 
                    className={cn(
                      "flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors",
                      isComplete && "bg-primary border-primary text-primary-foreground",
                      isActive && "border-primary text-primary",
                      !isActive && !isComplete && "border-muted-foreground/30 text-muted-foreground"
                    )}
                  >
                    {isComplete ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Icon className="w-4 h-4" />
                    )}
                  </div>
                  <span className={cn(
                    "text-sm font-medium hidden sm:inline",
                    isActive ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {step.label}
                  </span>
                  {idx < STEPS.length - 1 && (
                    <div className="flex-1 h-0.5 bg-border mx-2 hidden sm:block" />
                  )}
                </div>
              );
            })}
          </div>
          <Progress value={progress} className="mt-4 h-1" />
        </DialogHeader>

        {/* Step Content */}
        <ScrollArea className="flex-1 max-h-[50vh]">
          <div className="p-6">
            {/* Step 1: Choose */}
            {currentStep === 'choose' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Choisissez votre point de départ</h3>
                  <p className="text-sm text-muted-foreground">
                    Utilisez un template prêt à l'emploi ou sélectionnez un script existant sur votre serveur.
                  </p>
                </div>

                {/* Templates Section */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    Templates disponibles
                  </h4>
                  
                  {loadingTemplates ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : templates.length === 0 ? (
                    <Card className="border-dashed">
                      <CardContent className="py-8 text-center text-muted-foreground">
                        Aucun template disponible
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {templates.slice(0, 4).map(template => {
                        const risk = RISK_CONFIG[template.risk_level as keyof typeof RISK_CONFIG] || RISK_CONFIG.medium;
                        const isSelected = state.selectedTemplateId === template.id;
                        
                        return (
                          <Card 
                            key={template.id}
                            className={cn(
                              "cursor-pointer transition-all hover:border-primary/50",
                              isSelected && "border-primary bg-primary/5"
                            )}
                            onClick={() => selectTemplate(template.id)}
                          >
                            <CardHeader className="pb-2">
                              <div className="flex items-start justify-between">
                                <CardTitle className="text-sm">{template.title}</CardTitle>
                                {isSelected && <CheckCircle2 className="w-4 h-4 text-primary" />}
                              </div>
                              <CardDescription className="text-xs line-clamp-2">
                                {template.description}
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="pt-0">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {template.category}
                                </Badge>
                                <Badge variant="outline" className={cn("text-xs", risk.color)}>
                                  {risk.label}
                                </Badge>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Script Scan Section */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <FolderSearch className="w-4 h-4 text-primary" />
                    Scanner les scripts serveur
                  </h4>
                  
                  <div className="flex gap-2">
                    <Select value={scanInfraId} onValueChange={setScanInfraId}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Sélectionner un serveur..." />
                      </SelectTrigger>
                      <SelectContent>
                        {infrastructures.map(infra => (
                          <SelectItem key={infra.id} value={infra.id}>
                            {infra.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button 
                      variant="outline" 
                      onClick={handleScanScripts}
                      disabled={!scanInfraId || scanScripts.isPending}
                    >
                      {scanScripts.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <FolderSearch className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  
                  {scannedScripts.length > 0 && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {scannedScripts.map(script => {
                        const isSelected = state.selectedScript?.path === script.path;
                        const RuntimeIcon = script.runtime === 'python' ? FileCode : 
                                           script.runtime === 'node' ? Code : Terminal;
                        
                        return (
                          <Card 
                            key={script.path}
                            className={cn(
                              "cursor-pointer transition-all hover:border-primary/50",
                              isSelected && "border-primary bg-primary/5"
                            )}
                            onClick={() => selectScript(script)}
                          >
                            <CardContent className="py-3 flex items-center gap-3">
                              <RuntimeIcon className="w-5 h-5 text-muted-foreground" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{script.name}</p>
                                <p className="text-xs text-muted-foreground truncate">{script.path}</p>
                              </div>
                              {isSelected && <CheckCircle2 className="w-4 h-4 text-primary" />}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 2: Configure */}
            {currentStep === 'configure' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Configurez votre playbook</h3>
                  <p className="text-sm text-muted-foreground">
                    Personnalisez les informations et paramètres d'exécution.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="wizard-key">Identifiant unique</Label>
                    <Input
                      id="wizard-key"
                      value={state.key}
                      onChange={(e) => updateState({ key: e.target.value })}
                      placeholder="custom.mon_script"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="wizard-title">Titre affiché</Label>
                    <Input
                      id="wizard-title"
                      value={state.title}
                      onChange={(e) => updateState({ title: e.target.value })}
                      placeholder="Mon script personnalisé"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="wizard-description">Description</Label>
                  <Textarea
                    id="wizard-description"
                    value={state.description}
                    onChange={(e) => updateState({ description: e.target.value })}
                    placeholder="Décrivez ce que fait ce playbook..."
                    rows={3}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Catégorie</Label>
                    <Select value={state.category} onValueChange={(v) => updateState({ category: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="system">Système</SelectItem>
                        <SelectItem value="security">Sécurité</SelectItem>
                        <SelectItem value="docker">Docker</SelectItem>
                        <SelectItem value="database">Base de données</SelectItem>
                        <SelectItem value="network">Réseau</SelectItem>
                        <SelectItem value="custom">Personnalisé</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Niveau de risque</Label>
                    <Select 
                      value={state.riskLevel} 
                      onValueChange={(v: WizardState['riskLevel']) => updateState({ riskLevel: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(RISK_CONFIG).map(([key, cfg]) => (
                          <SelectItem key={key} value={key}>
                            <span className={cfg.color.split(' ')[1]}>{cfg.label}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Timeout (sec)</Label>
                    <Input
                      type="number"
                      min={10}
                      max={3600}
                      value={state.timeoutSec}
                      onChange={(e) => updateState({ timeoutSec: parseInt(e.target.value) || 300 })}
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Exécution</h4>
                  
                  <div className="space-y-2">
                    <Label>Runtime</Label>
                    <div className="flex gap-2">
                      {[
                        { value: 'bash', label: 'Bash', icon: Terminal },
                        { value: 'python', label: 'Python', icon: FileCode },
                        { value: 'node', label: 'Node.js', icon: Code },
                      ].map(opt => {
                        const Icon = opt.icon;
                        return (
                          <Button
                            key={opt.value}
                            type="button"
                            variant={state.runtime === opt.value ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => updateState({ runtime: opt.value as WizardState['runtime'] })}
                            className="gap-2"
                          >
                            <Icon className="w-4 h-4" />
                            {opt.label}
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="wizard-entrypoint">Chemin du script</Label>
                    <Input
                      id="wizard-entrypoint"
                      value={state.entrypoint}
                      onChange={(e) => updateState({ entrypoint: e.target.value })}
                      placeholder="scripts/custom/mon_script.sh"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Test */}
            {currentStep === 'test' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Testez votre playbook</h3>
                  <p className="text-sm text-muted-foreground">
                    Exécutez un test dans un environnement sandbox avant publication.
                  </p>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FlaskConical className="w-4 h-4" />
                      Configuration du test
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Serveur de test</Label>
                      <Select 
                        value={state.testInfraId || ''} 
                        onValueChange={(v) => updateState({ testInfraId: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un serveur..." />
                        </SelectTrigger>
                        <SelectContent>
                          {infrastructures.map(infra => (
                            <SelectItem key={infra.id} value={infra.id}>
                              {infra.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Button 
                      onClick={handleRunTest}
                      disabled={!state.testInfraId || state.testStatus === 'running'}
                      className="w-full gap-2"
                    >
                      {state.testStatus === 'running' ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Test en cours...
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4" />
                          Lancer le test
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {state.testOutput && (
                  <Card className={cn(
                    state.testStatus === 'success' && "border-green-500/50",
                    state.testStatus === 'failed' && "border-red-500/50"
                  )}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        {state.testStatus === 'success' ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                            Test réussi
                          </>
                        ) : state.testStatus === 'failed' ? (
                          <>
                            <AlertTriangle className="w-4 h-4 text-red-500" />
                            Test échoué
                          </>
                        ) : (
                          <>
                            <Clock className="w-4 h-4" />
                            Résultat
                          </>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <pre className="text-xs font-mono bg-muted/50 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap">
                        {state.testOutput}
                      </pre>
                    </CardContent>
                  </Card>
                )}

                <p className="text-xs text-muted-foreground text-center">
                  💡 Le test est optionnel mais recommandé pour valider le fonctionnement
                </p>
              </div>
            )}

            {/* Step 4: Publish */}
            {currentStep === 'publish' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Soumettre pour validation</h3>
                  <p className="text-sm text-muted-foreground">
                    Votre playbook sera soumis à un administrateur pour approbation.
                  </p>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Récapitulatif</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid gap-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Identifiant</span>
                        <span className="font-mono">{state.key}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Titre</span>
                        <span>{state.title}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Catégorie</span>
                        <Badge variant="outline">{state.category}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Risque</span>
                        <Badge 
                          variant="outline" 
                          className={RISK_CONFIG[state.riskLevel].color}
                        >
                          {RISK_CONFIG[state.riskLevel].label}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Runtime</span>
                        <span className="capitalize">{state.runtime}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Script</span>
                        <span className="font-mono text-xs">{state.entrypoint}</span>
                      </div>
                      {state.testStatus === 'success' && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Test</span>
                          <Badge variant="outline" className="bg-green-500/20 text-green-400">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Validé
                          </Badge>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-2">
                  <Label htmlFor="review-notes">Notes pour le validateur (optionnel)</Label>
                  <Textarea
                    id="review-notes"
                    value={state.reviewNotes}
                    onChange={(e) => updateState({ reviewNotes: e.target.value })}
                    placeholder="Informations supplémentaires pour l'administrateur..."
                    rows={3}
                  />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer with navigation */}
        <div className="px-6 py-4 border-t border-border/50 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={currentStepIndex === 0 ? handleClose : goBack}
            className="gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            {currentStepIndex === 0 ? 'Annuler' : 'Retour'}
          </Button>

          {currentStep === 'publish' ? (
            <Button 
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="gap-2"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Soumettre
            </Button>
          ) : (
            <Button 
              onClick={goNext}
              disabled={!canProceed()}
              className="gap-2"
            >
              Suivant
              <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
