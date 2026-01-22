/**
 * PlaybookVersionHistory
 * 
 * Git-like version history for playbooks with:
 * - Version timeline
 * - Changelog display
 * - Rollback capability
 * - Diff view (simplified)
 */

import { useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  History, 
  GitBranch, 
  RotateCcw, 
  Clock, 
  User,
  FileText,
  Loader2,
  Plus,
  CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  usePlaybookVersions, 
  useRollbackPlaybook,
  useCreatePlaybookVersion,
  type PlaybookVersion,
  type LocalPlaybook 
} from '@/hooks/usePlaybookGovernance';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface PlaybookVersionHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playbook: LocalPlaybook | null;
}

export function PlaybookVersionHistory({ 
  open, 
  onOpenChange,
  playbook 
}: PlaybookVersionHistoryProps) {
  const [selectedVersion, setSelectedVersion] = useState<PlaybookVersion | null>(null);
  const [showRollbackDialog, setShowRollbackDialog] = useState(false);
  const [showNewVersionDialog, setShowNewVersionDialog] = useState(false);
  const [changelog, setChangelog] = useState('');

  const { data: versions = [], isLoading } = usePlaybookVersions(playbook?.id);
  const rollback = useRollbackPlaybook();
  const createVersion = useCreatePlaybookVersion();

  const handleRollback = async () => {
    if (!playbook || !selectedVersion) return;
    
    await rollback.mutateAsync({
      playbookId: playbook.id,
      versionId: selectedVersion.id,
    });
    
    setShowRollbackDialog(false);
    setSelectedVersion(null);
  };

  const handleCreateVersion = async () => {
    if (!playbook || !changelog.trim()) return;
    
    await createVersion.mutateAsync({
      playbookId: playbook.id,
      changelog: changelog.trim(),
    });
    
    setShowNewVersionDialog(false);
    setChangelog('');
  };

  if (!playbook) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />
              Historique des versions
            </SheetTitle>
            <SheetDescription>
              {playbook.title} • v{playbook.current_version}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            {/* Create new version button */}
            <Button 
              onClick={() => setShowNewVersionDialog(true)}
              className="w-full gap-2"
              variant="outline"
            >
              <Plus className="w-4 h-4" />
              Créer une nouvelle version
            </Button>

            <Separator />

            {/* Version timeline */}
            <ScrollArea className="h-[calc(100vh-280px)]">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : versions.length === 0 ? (
                <div className="text-center py-12">
                  <GitBranch className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">Aucun historique de version</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">
                    Les versions sont créées lors des modifications
                  </p>
                </div>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
                  
                  <div className="space-y-4">
                    {versions.map((version, index) => {
                      const isLatest = index === 0;
                      const isCurrent = version.version === playbook.current_version;
                      
                      return (
                        <div key={version.id} className="relative pl-10">
                          {/* Timeline dot */}
                          <div 
                            className={cn(
                              "absolute left-2.5 w-3 h-3 rounded-full border-2",
                              isCurrent 
                                ? "bg-primary border-primary" 
                                : "bg-background border-muted-foreground/50"
                            )}
                          />
                          
                          <Card 
                            className={cn(
                              "cursor-pointer transition-all hover:border-primary/50",
                              selectedVersion?.id === version.id && "border-primary bg-primary/5"
                            )}
                            onClick={() => setSelectedVersion(
                              selectedVersion?.id === version.id ? null : version
                            )}
                          >
                            <CardHeader className="pb-2">
                              <div className="flex items-start justify-between">
                                <div>
                                  <CardTitle className="text-sm flex items-center gap-2">
                                    v{version.version}
                                    {isLatest && (
                                      <Badge variant="outline" className="text-xs">
                                        Dernière
                                      </Badge>
                                    )}
                                    {isCurrent && (
                                      <Badge className="text-xs bg-primary/20 text-primary border-primary/30">
                                        <CheckCircle2 className="w-3 h-3 mr-1" />
                                        Active
                                      </Badge>
                                    )}
                                  </CardTitle>
                                  <CardDescription className="text-xs mt-1">
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      {format(new Date(version.created_at), "dd MMM yyyy 'à' HH:mm", { locale: fr })}
                                    </span>
                                  </CardDescription>
                                </div>
                              </div>
                            </CardHeader>
                            
                            {version.changelog && (
                              <CardContent className="pt-0">
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                  {version.changelog}
                                </p>
                              </CardContent>
                            )}
                          </Card>
                          
                          {/* Expanded details */}
                          {selectedVersion?.id === version.id && (
                            <div className="mt-3 p-4 rounded-lg bg-muted/50 border border-border/50 space-y-4">
                              <div className="grid gap-3 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Entrypoint</span>
                                  <code className="text-xs bg-muted px-2 py-0.5 rounded">
                                    {version.entrypoint}
                                  </code>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Runtime</span>
                                  <span className="capitalize">{version.runtime}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Timeout</span>
                                  <span>{version.timeout_sec}s</span>
                                </div>
                                {version.risk_level && (
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Risque</span>
                                    <Badge variant="outline" className="capitalize">
                                      {version.risk_level}
                                    </Badge>
                                  </div>
                                )}
                              </div>
                              
                              {!isCurrent && (
                                <>
                                  <Separator />
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setShowRollbackDialog(true);
                                    }}
                                    className="w-full gap-2"
                                  >
                                    <RotateCcw className="w-4 h-4" />
                                    Restaurer cette version
                                  </Button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </ScrollArea>
          </div>
        </SheetContent>
      </Sheet>

      {/* Rollback confirmation dialog */}
      <AlertDialog open={showRollbackDialog} onOpenChange={setShowRollbackDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer le rollback</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir restaurer la version {selectedVersion?.version} ?
              {selectedVersion?.changelog && (
                <span className="block mt-2 p-2 bg-muted rounded text-sm">
                  "{selectedVersion.changelog}"
                </span>
              )}
              <span className="block mt-2 text-yellow-500">
                ⚠️ Cette action remplacera la configuration actuelle.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRollback}
              disabled={rollback.isPending}
              className="gap-2"
            >
              {rollback.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RotateCcw className="w-4 h-4" />
              )}
              Restaurer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* New version dialog */}
      <AlertDialog open={showNewVersionDialog} onOpenChange={setShowNewVersionDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Créer une nouvelle version</AlertDialogTitle>
            <AlertDialogDescription>
              Enregistrez l'état actuel du playbook comme nouvelle version.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="changelog">Changelog / Notes de version</Label>
              <Textarea
                id="changelog"
                value={changelog}
                onChange={(e) => setChangelog(e.target.value)}
                placeholder="Décrivez les changements de cette version..."
                rows={4}
              />
            </div>
          </div>
          
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setChangelog('')}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCreateVersion}
              disabled={!changelog.trim() || createVersion.isPending}
              className="gap-2"
            >
              {createVersion.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Créer v{(playbook?.current_version || 1) + 1}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
