import { Link } from 'react-router-dom';
import { ExternalLink, Unlink, Link2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Infrastructure, useAssociateRunner } from '@/hooks/useInfrastructures';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Runner {
  id: string;
  name: string;
  status: string;
  infrastructure_id: string | null;
  host_info: Record<string, unknown>;
}

interface InfraDetailsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  infrastructure: Infrastructure | null;
  runners: Runner[];
}

const statusColors: Record<string, string> = {
  online: 'bg-green-500',
  offline: 'bg-gray-500',
  paused: 'bg-yellow-500',
  unknown: 'bg-gray-400',
};

export function InfraDetails({ open, onOpenChange, infrastructure, runners }: InfraDetailsProps) {
  const associateRunner = useAssociateRunner();

  if (!infrastructure) return null;

  const associatedRunner = runners.find(r => r.infrastructure_id === infrastructure.id);
  const availableRunners = runners.filter(r => !r.infrastructure_id);

  const handleAssociate = (runnerId: string) => {
    associateRunner.mutate({ runnerId, infrastructureId: infrastructure.id });
  };

  const handleDissociate = () => {
    if (associatedRunner) {
      associateRunner.mutate({ runnerId: associatedRunner.id, infrastructureId: null });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {infrastructure.name}
            <Badge variant="outline">{infrastructure.type.toUpperCase()}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Specs */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {infrastructure.os && (
              <div>
                <span className="text-muted-foreground">OS:</span>{' '}
                <span className="font-medium">{infrastructure.os}</span>
              </div>
            )}
            {infrastructure.distribution && (
              <div>
                <span className="text-muted-foreground">Distribution:</span>{' '}
                <span className="font-medium">{infrastructure.distribution}</span>
              </div>
            )}
            {infrastructure.architecture && (
              <div>
                <span className="text-muted-foreground">Architecture:</span>{' '}
                <span className="font-medium">{infrastructure.architecture}</span>
              </div>
            )}
            {infrastructure.cpu_cores && (
              <div>
                <span className="text-muted-foreground">CPU:</span>{' '}
                <span className="font-medium">{infrastructure.cpu_cores} cores</span>
              </div>
            )}
            {infrastructure.ram_gb && (
              <div>
                <span className="text-muted-foreground">RAM:</span>{' '}
                <span className="font-medium">{infrastructure.ram_gb} GB</span>
              </div>
            )}
            {infrastructure.disk_gb && (
              <div>
                <span className="text-muted-foreground">Disque:</span>{' '}
                <span className="font-medium">{infrastructure.disk_gb} GB</span>
              </div>
            )}
          </div>

          {infrastructure.notes && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium mb-1">Notes</h4>
                <p className="text-sm text-muted-foreground">{infrastructure.notes}</p>
              </div>
            </>
          )}

          <Separator />

          {/* Runner Association */}
          <div>
            <h4 className="text-sm font-medium mb-3">Runner Associé</h4>
            
            {associatedRunner ? (
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${statusColors[associatedRunner.status]}`} />
                  <div>
                    <p className="font-medium">{associatedRunner.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Status: {associatedRunner.status}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button asChild variant="ghost" size="sm">
                    <Link to="/runner">
                      <ExternalLink className="w-4 h-4 mr-1" />
                      Voir
                    </Link>
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleDissociate}
                    disabled={associateRunner.isPending}
                  >
                    <Unlink className="w-4 h-4 mr-1" />
                    Dissocier
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Aucun runner associé</p>
                
                {availableRunners.length > 0 ? (
                  <div className="flex gap-2">
                    <Select onValueChange={handleAssociate}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Sélectionner un runner" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableRunners.map(runner => (
                          <SelectItem key={runner.id} value={runner.id}>
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${statusColors[runner.status]}`} />
                              {runner.name} 
                              <span className="text-muted-foreground">({runner.status})</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button 
                      size="icon"
                      variant="outline"
                      disabled={associateRunner.isPending}
                    >
                      <Link2 className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-amber-500">
                    Aucun runner disponible. Tous les runners sont déjà associés.
                  </p>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* Metadata */}
          <div className="text-xs text-muted-foreground">
            <p>Créé {formatDistanceToNow(new Date(infrastructure.created_at), { addSuffix: true, locale: fr })}</p>
            <p>Mis à jour {formatDistanceToNow(new Date(infrastructure.updated_at), { addSuffix: true, locale: fr })}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
