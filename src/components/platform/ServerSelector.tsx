import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Server, Wifi, WifiOff, Link2Off } from 'lucide-react';
import { ProxyServer, ProxyRunner } from '@/lib/api/ordersAdminProxy';

interface ServerSelectorProps {
  servers: ProxyServer[];
  runnersById: Map<string, ProxyRunner>;
  selectedId?: string;
  onSelect: (id: string | undefined) => void;
  disabled?: boolean;
}

export function ServerSelector({ 
  servers, 
  runnersById,
  selectedId, 
  onSelect,
  disabled = false
}: ServerSelectorProps) {
  // Get runner for a server
  const getServerRunner = (server: ProxyServer): ProxyRunner | undefined => {
    if (!server.runnerId) return undefined;
    return runnersById.get(server.runnerId);
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Server className="w-4 h-4" />
        <span>Serveur :</span>
      </div>
      
      <Select 
        value={selectedId || ''} 
        onValueChange={(value) => onSelect(value || undefined)}
        disabled={disabled}
      >
        <SelectTrigger className="w-full sm:w-[320px]">
          <SelectValue placeholder="Sélectionner un serveur" />
        </SelectTrigger>
        <SelectContent>
          {servers.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              Aucun serveur disponible
            </div>
          ) : (
            servers.map((server) => {
              const runner = getServerRunner(server);
              const hasRunner = !!runner;
              const isOnline = runner?.status === 'ONLINE';

              return (
                <SelectItem key={server.id} value={server.id}>
                  <div className="flex items-center gap-2">
                    <span className="truncate max-w-[180px]">{server.name}</span>
                    <Badge 
                      variant="outline" 
                      className={`text-[10px] px-1.5 py-0 flex-shrink-0 ${
                        !hasRunner 
                          ? 'bg-muted text-muted-foreground border-border' 
                          : isOnline 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      }`}
                    >
                      {!hasRunner ? (
                        <><Link2Off className="w-2.5 h-2.5 mr-1" />Pas d'agent</>
                      ) : isOnline ? (
                        <><Wifi className="w-2.5 h-2.5 mr-1" />{runner.name}</>
                      ) : (
                        <><WifiOff className="w-2.5 h-2.5 mr-1" />{runner.name}</>
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
          disabled={disabled}
        >
          Désélectionner
        </button>
      )}
    </div>
  );
}
