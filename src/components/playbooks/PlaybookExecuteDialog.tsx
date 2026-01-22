/**
 * PlaybookExecuteDialog
 * 
 * Schema-driven execution form that:
 * - Reads the playbook's JSON schema
 * - Generates input fields for each parameter
 * - Validates required fields
 * - Submits order to API
 */

import { useState, useMemo } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Play, 
  Loader2, 
  AlertTriangle,
  Terminal,
  Shield,
  HardDrive,
  Globe,
  Database,
  Zap,
  Settings
} from 'lucide-react';
import { useCreateOrder, OrderCategory } from '@/hooks/useOrders';
import { PlaybookItem, PlaybookSchema } from '@/hooks/usePlaybooks';
import { toast } from '@/hooks/use-toast';

interface PlaybookExecuteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playbook: PlaybookItem | null;
  serverId: string;
  runnerId: string;
  serverName?: string;
}

const riskColors = {
  low: 'bg-green-500/10 text-green-400 border-green-500/30',
  medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  high: 'bg-red-500/10 text-red-400 border-red-500/30',
};

function getPlaybookIcon(key: string) {
  if (key.startsWith('system.')) return Terminal;
  if (key.startsWith('security.')) return Shield;
  if (key.startsWith('docker.')) return HardDrive;
  if (key.startsWith('network.')) return Globe;
  if (key.startsWith('database.')) return Database;
  if (key.startsWith('runtime.')) return Zap;
  return Settings;
}

function getPlaybookGroup(key: string): string {
  return key.split('.')[0] || 'other';
}

export function PlaybookExecuteDialog({ 
  open, 
  onOpenChange, 
  playbook,
  serverId,
  runnerId,
  serverName
}: PlaybookExecuteDialogProps) {
  const createOrder = useCreateOrder();
  const [action, setAction] = useState<string>('run');
  const [params, setParams] = useState<Record<string, unknown>>({});

  // Reset form when playbook changes
  useMemo(() => {
    if (playbook) {
      setAction(playbook.actions[0] || 'run');
      // Initialize params with defaults from schema
      const defaults: Record<string, unknown> = {};
      const props = playbook.schema?.properties || {};
      for (const [key, prop] of Object.entries(props)) {
        if ((prop as any).default !== undefined) {
          defaults[key] = (prop as any).default;
        }
      }
      setParams(defaults);
    }
  }, [playbook?.key]);

  if (!playbook) return null;

  const Icon = getPlaybookIcon(playbook.key);
  const schemaProperties = playbook.schema?.properties || {};
  const requiredFields = playbook.schema?.required || [];
  const hasParams = Object.keys(schemaProperties).length > 0;

  // Map playbook group to order category
  const getCategory = (): OrderCategory => {
    const group = getPlaybookGroup(playbook.key);
    const categoryMap: Record<string, OrderCategory> = {
      system: 'detection',
      network: 'security',
      runtime: 'installation',
      docker: 'installation',
      security: 'security',
      database: 'installation',
      other: 'maintenance',
    };
    return categoryMap[group] || 'maintenance';
  };

  // Validate required params
  const isValid = useMemo(() => {
    for (const field of requiredFields) {
      const value = params[field];
      if (value === undefined || value === null || value === '') {
        return false;
      }
    }
    return true;
  }, [params, requiredFields]);

  const handleParamChange = (name: string, value: unknown) => {
    setParams(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await createOrder.mutateAsync({
        runner_id: runnerId,
        server_id: serverId,
        category: getCategory(),
        name: playbook.title,
        description: `[${playbook.key}] ${playbook.description}`,
        command: `playbook:${playbook.key}:${action}`,
        playbook_key: playbook.key,
        action,
        params: hasParams ? params : undefined,
      });
      
      toast({
        title: 'Playbook lancé',
        description: `${playbook.title} en cours d'exécution sur ${serverName || serverId}`,
      });
      
      onOpenChange(false);
    } catch {
      // Error handled by mutation
    }
  };

  // Render input based on schema property type
  const renderInput = (name: string, prop: any) => {
    const value = params[name];
    const isRequired = requiredFields.includes(name);

    // Enum -> Select
    if (prop.enum) {
      return (
        <Select 
          value={String(value ?? '')} 
          onValueChange={(v) => handleParamChange(name, v)}
        >
          <SelectTrigger>
            <SelectValue placeholder={`Sélectionner ${name}`} />
          </SelectTrigger>
          <SelectContent>
            {prop.enum.map((opt: string) => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    // Boolean -> Checkbox
    if (prop.type === 'boolean') {
      return (
        <div className="flex items-center gap-2">
          <Checkbox 
            id={name}
            checked={Boolean(value)}
            onCheckedChange={(v) => handleParamChange(name, v)}
          />
          <Label htmlFor={name} className="text-sm text-muted-foreground">
            {prop.description || name}
          </Label>
        </div>
      );
    }

    // Number
    if (prop.type === 'number' || prop.type === 'integer') {
      return (
        <Input
          type="number"
          value={value !== undefined ? String(value) : ''}
          onChange={(e) => handleParamChange(name, e.target.value ? Number(e.target.value) : undefined)}
          placeholder={prop.description || name}
        />
      );
    }

    // String with long description -> Textarea
    if (prop.type === 'string' && (prop.description?.length > 50 || name.includes('content') || name.includes('script'))) {
      return (
        <Textarea
          value={String(value ?? '')}
          onChange={(e) => handleParamChange(name, e.target.value)}
          placeholder={prop.description || name}
          rows={4}
        />
      );
    }

    // Default -> Text input
    return (
      <Input
        type="text"
        value={String(value ?? '')}
        onChange={(e) => handleParamChange(name, e.target.value)}
        placeholder={prop.description || name}
      />
    );
  };

  const riskLevel = (playbook as any).riskLevel || 
    (playbook.visibility === 'internal' ? 'medium' : 'low');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="flex items-center gap-2 flex-wrap">
                {playbook.title}
                <Badge variant="outline" className={riskColors[riskLevel]}>
                  {riskLevel === 'low' ? 'Faible' : riskLevel === 'medium' ? 'Modéré' : 'Élevé'}
                </Badge>
              </DialogTitle>
              <DialogDescription>
                {playbook.description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <ScrollArea className="max-h-[50vh] pr-4">
            <div className="space-y-4 py-4">
              {/* Action selector (if multiple) */}
              {playbook.actions.length > 1 && (
                <div className="space-y-2">
                  <Label>Action</Label>
                  <Select value={action} onValueChange={setAction}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {playbook.actions.map(a => (
                        <SelectItem key={a} value={a}>{a}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Schema-driven params */}
              {hasParams ? (
                <div className="space-y-4">
                  <Label className="text-muted-foreground">Paramètres</Label>
                  {Object.entries(schemaProperties).map(([name, prop]) => {
                    const isRequired = requiredFields.includes(name);
                    if ((prop as any).type === 'boolean') {
                      return (
                        <div key={name}>
                          {renderInput(name, prop)}
                        </div>
                      );
                    }
                    return (
                      <div key={name} className="space-y-2">
                        <Label htmlFor={name} className="flex items-center gap-2">
                          {name}
                          {isRequired && (
                            <span className="text-destructive">*</span>
                          )}
                        </Label>
                        {renderInput(name, prop)}
                        {(prop as any).description && (prop as any).type !== 'boolean' && (
                          <p className="text-xs text-muted-foreground">
                            {(prop as any).description}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground p-4 rounded-lg bg-muted/50 border border-border/50">
                  Ce playbook ne nécessite aucun paramètre. Cliquez sur "Exécuter" pour lancer.
                </div>
              )}

              {/* Warning for high risk */}
              {riskLevel === 'high' && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong>Attention :</strong> Ce playbook peut avoir des effets irréversibles. 
                    Assurez-vous de comprendre son fonctionnement avant de l'exécuter.
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={!isValid || createOrder.isPending}
              className="gap-2"
            >
              {createOrder.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              Exécuter
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
