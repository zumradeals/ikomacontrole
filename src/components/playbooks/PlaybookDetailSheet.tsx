/**
 * PlaybookDetailSheet
 * 
 * Detailed view ("fiche") of a playbook showing:
 * - Title, description, version
 * - Usage instructions
 * - Parameters (from schema)
 * - Examples
 * - Risks and effects
 * - Requirements
 */

import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle,
  SheetDescription 
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { 
  Play, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Code,
  Terminal,
  FileCode,
  Settings,
  Shield,
  HardDrive,
  Globe,
  Database,
  Zap,
  FileText,
  Loader2,
  BookOpen,
  Lightbulb,
  Info
} from 'lucide-react';
import { usePlaybookDetail, type PlaybookDefinition } from '@/hooks/usePlaybookAdmin';

interface PlaybookDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playbookKey: string | null;
  onExecute?: (playbook: PlaybookDefinition) => void;
}

const riskColors = {
  low: 'bg-green-500/10 text-green-400 border-green-500/30',
  medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  high: 'bg-red-500/10 text-red-400 border-red-500/30',
};

const riskLabels = {
  low: 'Risque faible',
  medium: 'Risque modéré',
  high: 'Risque élevé',
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

function getRuntimeIcon(type: string) {
  switch (type) {
    case 'bash': return Terminal;
    case 'python': return FileCode;
    case 'node': return Code;
    default: return FileText;
  }
}

export function PlaybookDetailSheet({ 
  open, 
  onOpenChange, 
  playbookKey,
  onExecute 
}: PlaybookDetailSheetProps) {
  const { data: playbook, isLoading, error } = usePlaybookDetail(playbookKey || undefined);

  const Icon = playbookKey ? getPlaybookIcon(playbookKey) : Settings;
  const RuntimeIcon = playbook?.runtime?.type ? getRuntimeIcon(playbook.runtime.type) : Terminal;

  const schemaProperties = playbook?.schema?.properties || {};
  const requiredFields = playbook?.schema?.required || [];
  const hasParams = Object.keys(schemaProperties).length > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/50">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
          ) : error ? (
            <div>
              <SheetTitle className="text-destructive">Erreur</SheetTitle>
              <SheetDescription>{error.message}</SheetDescription>
            </div>
          ) : playbook ? (
            <>
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Icon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <SheetTitle className="flex items-center gap-2 flex-wrap">
                    {playbook.title}
                    <Badge variant="outline" className={riskColors[playbook.riskLevel || 'medium']}>
                      {riskLabels[playbook.riskLevel || 'medium']}
                    </Badge>
                    {playbook.visibility === 'internal' && (
                      <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30">
                        Expert
                      </Badge>
                    )}
                  </SheetTitle>
                  <SheetDescription className="mt-1">
                    {playbook.description}
                  </SheetDescription>
                </div>
              </div>
              
              {/* Quick info row */}
              <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  v{playbook.version}
                </div>
                <div className="flex items-center gap-1">
                  <RuntimeIcon className="w-3 h-3" />
                  {playbook.runtime?.type || 'bash'}
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Timeout: {playbook.timeoutSec}s
                </div>
              </div>
            </>
          ) : null}
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-180px)]">
          {isLoading ? (
            <div className="p-6 space-y-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : playbook ? (
            <div className="p-6">
              <Accordion type="multiple" defaultValue={['usage', 'params']} className="space-y-2">
                {/* Usage */}
                <AccordionItem value="usage" className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-primary" />
                      <span>Utilisation</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground">
                    <div className="space-y-3">
                      <div>
                        <p className="font-medium text-foreground mb-1">Clé du playbook</p>
                        <code className="text-xs bg-muted px-2 py-1 rounded">{playbook.key}</code>
                      </div>
                      
                      <div>
                        <p className="font-medium text-foreground mb-1">Actions disponibles</p>
                        <div className="flex gap-2 flex-wrap">
                          {playbook.actions.map(action => (
                            <Badge key={action} variant="secondary">{action}</Badge>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="font-medium text-foreground mb-1">Entrypoint</p>
                        <code className="text-xs bg-muted px-2 py-1 rounded">{playbook.entrypoint}</code>
                      </div>

                      {playbook.workdir && (
                        <div>
                          <p className="font-medium text-foreground mb-1">Répertoire de travail</p>
                          <code className="text-xs bg-muted px-2 py-1 rounded">{playbook.workdir}</code>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Parameters */}
                <AccordionItem value="params" className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2">
                      <Settings className="w-4 h-4 text-primary" />
                      <span>Paramètres</span>
                      {hasParams && (
                        <Badge variant="outline" className="ml-2">
                          {Object.keys(schemaProperties).length}
                        </Badge>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {hasParams ? (
                      <div className="space-y-3">
                        {Object.entries(schemaProperties).map(([name, prop]) => {
                          const isRequired = requiredFields.includes(name);
                          return (
                            <div 
                              key={name} 
                              className="p-3 rounded-lg bg-muted/50 border border-border/50"
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <code className="text-sm font-medium">{name}</code>
                                {isRequired && (
                                  <Badge variant="outline" className="text-[10px] px-1 py-0">
                                    Requis
                                  </Badge>
                                )}
                                <Badge variant="secondary" className="text-[10px] px-1 py-0">
                                  {(prop as any).type}
                                </Badge>
                              </div>
                              {(prop as any).description && (
                                <p className="text-xs text-muted-foreground">
                                  {(prop as any).description}
                                </p>
                              )}
                              {(prop as any).default !== undefined && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Défaut: <code>{JSON.stringify((prop as any).default)}</code>
                                </p>
                              )}
                              {(prop as any).enum && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Valeurs: {(prop as any).enum.join(', ')}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Aucun paramètre requis pour ce playbook.
                      </p>
                    )}
                  </AccordionContent>
                </AccordionItem>

                {/* Examples */}
                {playbook.examples && playbook.examples.length > 0 && (
                  <AccordionItem value="examples" className="border rounded-lg px-4">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-2">
                        <Lightbulb className="w-4 h-4 text-primary" />
                        <span>Exemples</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3">
                        {playbook.examples.map((example, idx) => (
                          <div key={idx} className="p-3 rounded-lg bg-muted/50 border border-border/50">
                            <p className="font-medium text-sm mb-1">{example.name}</p>
                            {example.description && (
                              <p className="text-xs text-muted-foreground mb-2">
                                {example.description}
                              </p>
                            )}
                            <pre className="text-xs bg-background p-2 rounded overflow-x-auto">
                              {JSON.stringify(example.input, null, 2)}
                            </pre>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* Effects / Risks */}
                {playbook.effects && playbook.effects.length > 0 && (
                  <AccordionItem value="effects" className="border rounded-lg px-4">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                        <span>Effets & Risques</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <ul className="space-y-2">
                        {playbook.effects.map((effect, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm">
                            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                            {effect}
                          </li>
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* Requirements */}
                {playbook.requirements && playbook.requirements.length > 0 && (
                  <AccordionItem value="requirements" className="border rounded-lg px-4">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-primary" />
                        <span>Prérequis</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <ul className="space-y-2">
                        {playbook.requirements.map((req, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm">
                            <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                            {req}
                          </li>
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                )}
              </Accordion>
            </div>
          ) : null}
        </ScrollArea>

        {/* Execute button footer */}
        {playbook && onExecute && (
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border bg-background">
            <Button 
              className="w-full gap-2" 
              onClick={() => onExecute(playbook)}
            >
              <Play className="w-4 h-4" />
              Exécuter ce playbook
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
