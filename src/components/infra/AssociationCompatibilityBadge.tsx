/**
 * Association Compatibility Badge
 * 
 * Shows the association status with "compatibility mode" indicator
 * when the API cannot confirm the association.
 */

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { AlertTriangle, CheckCircle2, HelpCircle, RefreshCw, Loader2 } from 'lucide-react';
import { checkRunnerAssociationVerifiable } from '@/lib/api/apiContractDiagnostic';

interface AssociationCompatibilityBadgeProps {
  runnerId: string | null;
  runnerName?: string | null;
  infrastructureId: string;
  /** If true, shows the "sent but unverifiable" state */
  pendingAssociation?: boolean;
  /** Callback to verify association */
  onVerify?: () => void;
}

type VerificationState = 
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'verified'; confirmed: boolean; message: string }
  | { status: 'unverifiable'; message: string };

export function AssociationCompatibilityBadge({
  runnerId,
  runnerName,
  infrastructureId,
  pendingAssociation = false,
  onVerify,
}: AssociationCompatibilityBadgeProps) {
  const [verification, setVerification] = useState<VerificationState>({ status: 'idle' });

  const handleVerify = async () => {
    if (!runnerId) return;
    
    setVerification({ status: 'checking' });
    
    try {
      const result = await checkRunnerAssociationVerifiable(runnerId, infrastructureId);
      
      if (result.verifiable) {
        setVerification({
          status: 'verified',
          confirmed: result.confirmed,
          message: result.message,
        });
      } else {
        setVerification({
          status: 'unverifiable',
          message: result.message,
        });
      }
    } catch (error) {
      setVerification({
        status: 'unverifiable',
        message: 'Erreur lors de la vérification',
      });
    }

    onVerify?.();
  };

  // No runner associated
  if (!runnerId && !pendingAssociation) {
    return (
      <Badge variant="outline" className="bg-muted text-muted-foreground">
        Non associé
      </Badge>
    );
  }

  // Pending association (sent but not verified)
  if (pendingAssociation && !runnerId) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 gap-1">
              <AlertTriangle className="h-3 w-3" />
              Association envoyée
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="max-w-xs text-xs">
              L'action d'association a été envoyée à l'API, mais elle n'est pas vérifiable 
              car l'API ne retourne pas les champs d'association.
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Runner is associated - show with verification option
  return (
    <div className="flex items-center gap-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant="outline" 
              className={
                verification.status === 'verified' && verification.confirmed
                  ? 'bg-green-50 text-green-700 border-green-200 gap-1'
                  : verification.status === 'verified' && !verification.confirmed
                  ? 'bg-red-50 text-red-700 border-red-200 gap-1'
                  : verification.status === 'unverifiable'
                  ? 'bg-yellow-50 text-yellow-700 border-yellow-200 gap-1'
                  : 'gap-1'
              }
            >
              {verification.status === 'verified' && verification.confirmed && (
                <CheckCircle2 className="h-3 w-3" />
              )}
              {verification.status === 'verified' && !verification.confirmed && (
                <AlertTriangle className="h-3 w-3" />
              )}
              {verification.status === 'unverifiable' && (
                <HelpCircle className="h-3 w-3" />
              )}
              {runnerName || runnerId}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="max-w-xs text-xs">
              {verification.status === 'idle' && 'Cliquez sur vérifier pour confirmer l\'association via l\'API'}
              {verification.status === 'checking' && 'Vérification en cours...'}
              {verification.status === 'verified' && verification.message}
              {verification.status === 'unverifiable' && (
                <>
                  <strong>Mode compatibilité:</strong> {verification.message}
                </>
              )}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0"
        onClick={handleVerify}
        disabled={verification.status === 'checking'}
      >
        {verification.status === 'checking' ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <RefreshCw className="h-3 w-3" />
        )}
      </Button>
    </div>
  );
}
