import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Server, Wifi, WifiOff } from 'lucide-react';
import { Infrastructure } from '@/hooks/useInfrastructures';

interface Runner {
  id: string;
  name: string;
  status: string;
  infrastructure_id: string | null;
}

interface InfraSelectorProps {
  infrastructures: Infrastructure[];
  runners: Runner[];
  selectedId?: string;
  onSelect: (id: string | undefined) => void;
}

export function InfraSelector({ 
  infrastructures, 
  runners, 
  selectedId, 
  onSelect 
}: InfraSelectorProps) {
  // Get runner status for each infrastructure
  const getInfraRunner = (infraId: string) => {
    return runners.find(r => r.infrastructure_id === infraId);
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Server className="w-4 h-4" />
        <span>Infrastructure :</span>
      </div>
      
      <Select 
        value={selectedId || ''} 
        onValueChange={(value) => onSelect(value || undefined)}
      >
        <SelectTrigger className="w-full sm:w-[280px]">
          <SelectValue placeholder="Sélectionner une infrastructure" />
        </SelectTrigger>
        <SelectContent>
          {infrastructures.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              Aucune infrastructure disponible
            </div>
          ) : (
            infrastructures.map((infra) => {
              const runner = getInfraRunner(infra.id);
              const hasRunner = !!runner;
              const isOnline = runner?.status === 'online';

              return (
                <SelectItem key={infra.id} value={infra.id}>
                  <div className="flex items-center gap-2">
                    <span>{infra.name}</span>
                    <Badge 
                      variant="outline" 
                      className={`text-[10px] px-1.5 py-0 ${
                        !hasRunner 
                          ? 'bg-muted text-muted-foreground' 
                          : isOnline 
                            ? 'bg-green-500/10 text-green-400 border-green-500/30' 
                            : 'bg-red-500/10 text-red-400 border-red-500/30'
                      }`}
                    >
                      {!hasRunner ? (
                        'Pas de runner'
                      ) : isOnline ? (
                        <><Wifi className="w-2.5 h-2.5 mr-1" />Online</>
                      ) : (
                        <><WifiOff className="w-2.5 h-2.5 mr-1" />Offline</>
                      )}
                    </Badge>
                  </div>
                </SelectItem>
              );
            })
          )}
        </SelectContent>
      </Select>

      {selectedId && (
        <button
          onClick={() => onSelect(undefined)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Désélectionner
        </button>
      )}
    </div>
  );
}
