/**
 * PlaybookCreateForm
 * 
 * Form to create a new playbook with:
 * - key, title, description
 * - runtime (bash/python/node)
 * - entrypoint (script path)
 * - schema (JSON)
 * - timeout, workdir
 * - visibility, category, risk level
 */

import { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, 
  Loader2, 
  Code, 
  FileCode, 
  Settings, 
  AlertTriangle,
  FolderSearch,
  Terminal,
  FileText
} from 'lucide-react';
import { useCreatePlaybook, useTriggerScriptScan, type ScriptInfo } from '@/hooks/usePlaybookAdmin';

interface PlaybookCreateFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serverId?: string;
}

const RUNTIME_OPTIONS = [
  { value: 'bash', label: 'Bash', icon: Terminal },
  { value: 'python', label: 'Python', icon: FileCode },
  { value: 'node', label: 'Node.js', icon: Code },
];

const CATEGORY_OPTIONS = [
  { value: 'system', label: 'Système' },
  { value: 'security', label: 'Sécurité' },
  { value: 'docker', label: 'Docker' },
  { value: 'network', label: 'Réseau' },
  { value: 'database', label: 'Base de données' },
  { value: 'runtime', label: 'Runtime' },
  { value: 'other', label: 'Autre' },
];

const RISK_OPTIONS = [
  { value: 'low', label: 'Faible', color: 'text-green-400' },
  { value: 'medium', label: 'Modéré', color: 'text-yellow-400' },
  { value: 'high', label: 'Élevé', color: 'text-red-400' },
];

const DEFAULT_SCHEMA = JSON.stringify({
  type: 'object',
  properties: {},
  required: []
}, null, 2);

export function PlaybookCreateForm({ open, onOpenChange, serverId }: PlaybookCreateFormProps) {
  const createPlaybook = useCreatePlaybook();
  const scanScripts = useTriggerScriptScan();
  
  // Form state
  const [key, setKey] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [runtime, setRuntime] = useState<'bash' | 'python' | 'node'>('bash');
  const [entrypoint, setEntrypoint] = useState('');
  const [timeoutSec, setTimeoutSec] = useState('300');
  const [workdir, setWorkdir] = useState('');
  const [schemaJson, setSchemaJson] = useState(DEFAULT_SCHEMA);
  const [visibility, setVisibility] = useState<'internal' | 'public'>('internal');
  const [category, setCategory] = useState('system');
  const [riskLevel, setRiskLevel] = useState<'low' | 'medium' | 'high'>('medium');
  const [effects, setEffects] = useState('');
  const [requirements, setRequirements] = useState('');
  
  // Script scan results
  const [scannedScripts, setScannedScripts] = useState<ScriptInfo[]>([]);
  
  const [schemaError, setSchemaError] = useState<string | null>(null);

  const handleScanScripts = async () => {
    if (!serverId) return;
    const result = await scanScripts.mutateAsync(serverId);
    setScannedScripts(result);
  };

  const handleSelectScript = (script: ScriptInfo) => {
    setEntrypoint(script.path);
    setRuntime(script.runtime === 'unknown' ? 'bash' : script.runtime);
    // Auto-generate key from script name
    if (!key) {
      const autoKey = script.name
        .replace(/\.(sh|py|js|ts)$/, '')
        .replace(/[^a-zA-Z0-9_]/g, '_')
        .toLowerCase();
      setKey(`custom.${autoKey}`);
    }
  };

  const validateSchema = (json: string): boolean => {
    try {
      const parsed = JSON.parse(json);
      if (parsed.type !== 'object') {
        setSchemaError('Le schéma doit avoir "type": "object"');
        return false;
      }
      setSchemaError(null);
      return true;
    } catch (e) {
      setSchemaError('JSON invalide');
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateSchema(schemaJson)) return;
    
    try {
      await createPlaybook.mutateAsync({
        key,
        title,
        description,
        runtime: { type: runtime },
        entrypoint,
        timeoutSec: parseInt(timeoutSec, 10),
        workdir: workdir || undefined,
        schema: JSON.parse(schemaJson),
        visibility,
        category,
        riskLevel,
        effects: effects.split('\n').filter(Boolean),
        requirements: requirements.split('\n').filter(Boolean),
      });
      
      // Reset form
      setKey('');
      setTitle('');
      setDescription('');
      setEntrypoint('');
      setSchemaJson(DEFAULT_SCHEMA);
      setEffects('');
      setRequirements('');
      onOpenChange(false);
    } catch {
      // Error handled by mutation
    }
  };

  const isValid = key && title && entrypoint && !schemaError;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50">
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" />
            Créer un Playbook
          </DialogTitle>
          <DialogDescription>
            Enregistrez un script existant comme playbook exécutable
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <ScrollArea className="max-h-[60vh]">
            <Tabs defaultValue="general" className="px-6 py-4">
              <TabsList className="mb-4">
                <TabsTrigger value="general">Général</TabsTrigger>
                <TabsTrigger value="execution">Exécution</TabsTrigger>
                <TabsTrigger value="schema">Schéma</TabsTrigger>
                <TabsTrigger value="metadata">Métadonnées</TabsTrigger>
              </TabsList>

              {/* General Tab */}
              <TabsContent value="general" className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="key">Clé unique *</Label>
                    <Input
                      id="key"
                      placeholder="category.script_name"
                      value={key}
                      onChange={(e) => setKey(e.target.value)}
                      pattern="[a-z0-9._]+"
                    />
                    <p className="text-xs text-muted-foreground">
                      Format: category.name (ex: system.backup_db)
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="title">Titre *</Label>
                    <Input
                      id="title"
                      placeholder="Backup Database"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Décrivez ce que fait ce playbook..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Visibilité</Label>
                    <Select value={visibility} onValueChange={(v: 'internal' | 'public') => setVisibility(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="public">Public</SelectItem>
                        <SelectItem value="internal">Interne (Expert)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Catégorie</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORY_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Niveau de risque</Label>
                    <Select value={riskLevel} onValueChange={(v: 'low' | 'medium' | 'high') => setRiskLevel(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RISK_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>
                            <span className={opt.color}>{opt.label}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </TabsContent>

              {/* Execution Tab */}
              <TabsContent value="execution" className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Runtime</Label>
                  </div>
                  <div className="flex gap-2">
                    {RUNTIME_OPTIONS.map(opt => {
                      const Icon = opt.icon;
                      return (
                        <Button
                          key={opt.value}
                          type="button"
                          variant={runtime === opt.value ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setRuntime(opt.value as typeof runtime)}
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
                  <div className="flex items-center justify-between">
                    <Label htmlFor="entrypoint">Entrypoint (chemin du script) *</Label>
                    {serverId && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleScanScripts}
                        disabled={scanScripts.isPending}
                        className="gap-1"
                      >
                        {scanScripts.isPending ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <FolderSearch className="w-3 h-3" />
                        )}
                        Rescan scripts
                      </Button>
                    )}
                  </div>
                  <Input
                    id="entrypoint"
                    placeholder="scripts/custom/backup.sh"
                    value={entrypoint}
                    onChange={(e) => setEntrypoint(e.target.value)}
                  />
                  
                  {/* Scanned scripts list */}
                  {scannedScripts.length > 0 && (
                    <div className="mt-2 p-3 rounded-lg bg-muted/50 border border-border/50">
                      <p className="text-xs text-muted-foreground mb-2">
                        Scripts disponibles ({scannedScripts.length}) :
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {scannedScripts.map(script => (
                          <Badge
                            key={script.path}
                            variant="outline"
                            className="cursor-pointer hover:bg-primary/10"
                            onClick={() => handleSelectScript(script)}
                          >
                            <FileText className="w-3 h-3 mr-1" />
                            {script.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="timeout">Timeout (secondes)</Label>
                    <Input
                      id="timeout"
                      type="number"
                      min={10}
                      max={3600}
                      value={timeoutSec}
                      onChange={(e) => setTimeoutSec(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="workdir">Répertoire de travail</Label>
                    <Input
                      id="workdir"
                      placeholder="/opt/scripts"
                      value={workdir}
                      onChange={(e) => setWorkdir(e.target.value)}
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Schema Tab */}
              <TabsContent value="schema" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="schema">Schéma des paramètres (JSON Schema)</Label>
                  <Textarea
                    id="schema"
                    className="font-mono text-sm"
                    value={schemaJson}
                    onChange={(e) => {
                      setSchemaJson(e.target.value);
                      validateSchema(e.target.value);
                    }}
                    rows={12}
                  />
                  {schemaError && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {schemaError}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Définit les paramètres d'entrée du playbook. Ces champs seront affichés dans le formulaire d'exécution.
                  </p>
                </div>
              </TabsContent>

              {/* Metadata Tab */}
              <TabsContent value="metadata" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="effects">Effets / Impacts (un par ligne)</Label>
                  <Textarea
                    id="effects"
                    placeholder="Redémarre le service nginx&#10;Peut causer une interruption de service"
                    value={effects}
                    onChange={(e) => setEffects(e.target.value)}
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="requirements">Prérequis (un par ligne)</Label>
                  <Textarea
                    id="requirements"
                    placeholder="Docker installé&#10;Accès root"
                    value={requirements}
                    onChange={(e) => setRequirements(e.target.value)}
                    rows={4}
                  />
                </div>
              </TabsContent>
            </Tabs>
          </ScrollArea>

          <DialogFooter className="px-6 py-4 border-t border-border/50">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={!isValid || createPlaybook.isPending}
              className="gap-2"
            >
              {createPlaybook.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Créer le playbook
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
