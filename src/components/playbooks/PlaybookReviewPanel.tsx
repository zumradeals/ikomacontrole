/**
 * PlaybookReviewPanel
 * 
 * Admin panel for reviewing and approving/rejecting playbooks
 * Shows list of pending_review playbooks with action buttons
 */

import { useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  FileText,
  User,
  Calendar,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Shield,
  Terminal,
  Loader2,
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  useLocalPlaybooksList,
  useSubmitReview,
  usePlaybookReviews,
  LocalPlaybook,
} from '@/hooks/usePlaybookGovernance';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

const riskLevelColors: Record<string, string> = {
  low: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  medium: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  high: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  critical: 'bg-destructive/10 text-destructive border-destructive/20',
};

const riskLevelLabels: Record<string, string> = {
  low: 'Faible',
  medium: 'Moyen',
  high: 'Élevé',
  critical: 'Critique',
};

interface ReviewDialogProps {
  playbook: LocalPlaybook | null;
  action: 'approve' | 'reject' | null;
  onClose: () => void;
  onSubmit: (comments: string) => void;
  isLoading: boolean;
}

function ReviewDialog({ playbook, action, onClose, onSubmit, isLoading }: ReviewDialogProps) {
  const [comments, setComments] = useState('');

  const handleSubmit = () => {
    onSubmit(comments);
    setComments('');
  };

  if (!playbook || !action) return null;

  return (
    <Dialog open={!!playbook && !!action} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {action === 'approve' ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            ) : (
              <XCircle className="h-5 w-5 text-destructive" />
            )}
            {action === 'approve' ? 'Approuver' : 'Rejeter'} le playbook
          </DialogTitle>
          <DialogDescription>
            {action === 'approve'
              ? 'Ce playbook sera publié et disponible pour exécution.'
              : 'Ce playbook sera marqué comme rejeté et devra être corrigé.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg border bg-muted/50 p-3">
            <p className="font-medium">{playbook.title}</p>
            <p className="text-sm text-muted-foreground">{playbook.key}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="comments">
              Commentaires {action === 'reject' && <span className="text-destructive">*</span>}
            </Label>
            <Textarea
              id="comments"
              placeholder={
                action === 'approve'
                  ? 'Commentaires optionnels...'
                  : 'Expliquez les raisons du rejet et les corrections attendues...'
              }
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Annuler
          </Button>
          <Button
            variant={action === 'approve' ? 'default' : 'destructive'}
            onClick={handleSubmit}
            disabled={isLoading || (action === 'reject' && !comments.trim())}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {action === 'approve' ? 'Approuver' : 'Rejeter'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface PlaybookReviewCardProps {
  playbook: LocalPlaybook;
  onApprove: (playbook: LocalPlaybook) => void;
  onReject: (playbook: LocalPlaybook) => void;
}

function PlaybookReviewCard({ playbook, onApprove, onReject }: PlaybookReviewCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card className="transition-shadow hover:shadow-md">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">{playbook.title}</CardTitle>
                <Badge variant="outline" className={riskLevelColors[playbook.risk_level]}>
                  {riskLevelLabels[playbook.risk_level]}
                </Badge>
              </div>
              <CardDescription className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1">
                  <Terminal className="h-3 w-3" />
                  {playbook.runtime}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(playbook.created_at), 'dd MMM yyyy', { locale: fr })}
                </span>
                <span className="font-mono text-muted-foreground">{playbook.key}</span>
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                onClick={() => onApprove(playbook)}
              >
                <CheckCircle2 className="mr-1 h-4 w-4" />
                Approuver
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => onReject(playbook)}
              >
                <XCircle className="mr-1 h-4 w-4" />
                Rejeter
              </Button>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0">
            <Separator className="mb-4" />
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Description</Label>
                  <p className="text-sm">{playbook.description || 'Aucune description'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Catégorie</Label>
                  <p className="text-sm capitalize">{playbook.category}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Point d'entrée</Label>
                  <p className="text-sm font-mono text-xs bg-muted px-2 py-1 rounded">
                    {playbook.entrypoint}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Timeout</Label>
                  <p className="text-sm">{playbook.timeout_sec} secondes</p>
                </div>
                {playbook.effects.length > 0 && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Effets</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {playbook.effects.map((effect) => (
                        <Badge key={effect} variant="secondary" className="text-xs">
                          {effect}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {playbook.requirements.length > 0 && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Prérequis</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {playbook.requirements.map((req) => (
                        <Badge key={req} variant="outline" className="text-xs">
                          {req}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export function PlaybookReviewPanel() {
  const { data: playbooks, isLoading } = useLocalPlaybooksList();
  const submitReview = useSubmitReview();

  const [selectedPlaybook, setSelectedPlaybook] = useState<LocalPlaybook | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | null>(null);

  // Filter pending review playbooks
  const pendingPlaybooks = playbooks?.filter((p) => p.status === 'pending_review') || [];

  const handleApprove = (playbook: LocalPlaybook) => {
    setSelectedPlaybook(playbook);
    setReviewAction('approve');
  };

  const handleReject = (playbook: LocalPlaybook) => {
    setSelectedPlaybook(playbook);
    setReviewAction('reject');
  };

  const handleSubmitReview = async (comments: string) => {
    if (!selectedPlaybook || !reviewAction) return;

    try {
      // First create a review record
      const { data: review, error: createError } = await supabase
        .from('playbook_reviews')
        .insert({
          playbook_id: selectedPlaybook.id,
          version: selectedPlaybook.current_version || 1,
          status: 'pending',
        })
        .select()
        .single();

      if (createError) throw createError;

      // Then submit the review decision
      await submitReview.mutateAsync({
        reviewId: review.id,
        status: reviewAction === 'approve' ? 'approved' : 'rejected',
        comments: comments || undefined,
      });

      setSelectedPlaybook(null);
      setReviewAction(null);
    } catch (error) {
      console.error('Review submission error:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de soumettre la révision',
        variant: 'destructive',
      });
    }
  };

  const handleCloseDialog = () => {
    setSelectedPlaybook(null);
    setReviewAction(null);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Validation des Playbooks
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Examinez et approuvez les playbooks soumis pour publication
          </p>
        </div>
        <Badge variant="outline" className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {pendingPlaybooks.length} en attente
        </Badge>
      </div>

      {pendingPlaybooks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mb-4" />
            <h3 className="font-medium text-lg">Aucun playbook en attente</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Tous les playbooks soumis ont été traités
            </p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[600px]">
          <div className="space-y-4 pr-4">
            {pendingPlaybooks.map((playbook) => (
              <PlaybookReviewCard
                key={playbook.id}
                playbook={playbook}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            ))}
          </div>
        </ScrollArea>
      )}

      <ReviewDialog
        playbook={selectedPlaybook}
        action={reviewAction}
        onClose={handleCloseDialog}
        onSubmit={handleSubmitReview}
        isLoading={submitReview.isPending}
      />
    </div>
  );
}
