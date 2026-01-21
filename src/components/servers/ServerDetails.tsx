import { 
  ArrowLeft, 
  Server, 
  Pencil, 
  Trash2, 
  Link2, 
  Link2Off, 
  Activity,
  Terminal,
  Clock,
  Globe
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { OrdersHistory } from '@/components/infra/OrdersHistory';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { ProxyServer, ProxyRunner } from '@/hooks/useApiServers';

interface ServerDetailsProps {
  server: ProxyServer;
  runner: ProxyRunner | null;
  runners: ProxyRunner[];
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRunnerChange: (runnerId: string | null) => void;
  isUpdating?: boolean;
}

export function ServerDetails({
  server,
  runner,
  runners,
  onBack,
  onEdit,
  onDelete,
  onRunnerChange,
  isUpdating,
}: ServerDetailsProps) {
  const hasRunner = !!server.runnerId;
  const runnerName = runner?.name || server.runnerName;
  const runnerStatus = runner?.status || server.runnerStatus;

  // Sort runners: ONLINE first
  const sortedRunners = [...runners].sort((a, b) => {
    if (a.status === 'ONLINE' && b.status !== 'ONLINE') return -1;
    if (a.status !== 'ONLINE' && b.status === 'ONLINE') return 1;
    return a.name.localeCompare(b.name);
  });

  const handleSelectChange = (value: string) => {
    onRunnerChange(value === '__none__' ? null : value);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20">
              <Server className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{server.name}</h1>
              {server.host && (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Globe className="w-3 h-3" />
                  {server.host}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="w-4 h-4 mr-2" />
            Modifier
          </Button>
          <Button variant="outline" size="sm" onClick={onDelete} className="text-destructive hover:text-destructive">
            <Trash2 className="w-4 h-4 mr-2" />
            Supprimer
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Server Info */}
        <div className="lg:col-span-1 space-y-4">
          {/* Status Card */}
          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Statut</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Association Badge */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge 
                  variant={hasRunner ? 'default' : 'secondary'}
                  className={cn(
                    'text-xs',
                    hasRunner && 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                  )}
                >
                  {hasRunner ? (
                    <><Link2 className="w-3 h-3 mr-1" /> Associé</>
                  ) : (
                    <><Link2Off className="w-3 h-3 mr-1" /> Non associé</>
                  )}
                </Badge>

                {hasRunner && runnerStatus && (
                  <Badge 
                    variant="outline"
                    className={cn(
                      'text-xs',
                      runnerStatus === 'ONLINE' && 'border-emerald-500/30 text-emerald-500',
                      runnerStatus === 'OFFLINE' && 'border-muted-foreground/30 text-muted-foreground'
                    )}
                  >
                    <span className={cn(
                      'w-1.5 h-1.5 rounded-full mr-1.5',
                      runnerStatus === 'ONLINE' ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground'
                    )} />
                    {runnerStatus === 'ONLINE' ? 'En ligne' : 'Hors ligne'}
                  </Badge>
                )}
              </div>

              {/* Runner Info */}
              {hasRunner && runnerName && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                  <Activity className="w-4 h-4 text-primary" />
                  <div>
                    <p className="text-sm font-medium">{runnerName}</p>
                    {runner?.lastHeartbeatAt && (
                      <p className="text-xs text-muted-foreground">
                        Vu {formatDistanceToNow(new Date(runner.lastHeartbeatAt), { addSuffix: true, locale: fr })}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <Separator />

              {/* Runner Selector */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Agent associé
                </label>
                <Select
                  value={server.runnerId || '__none__'}
                  onValueChange={handleSelectChange}
                  disabled={isUpdating}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sélectionner un agent..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      <span className="text-muted-foreground">Aucun (dissocier)</span>
                    </SelectItem>
                    {sortedRunners.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            'w-2 h-2 rounded-full',
                            r.status === 'ONLINE' ? 'bg-emerald-500' : 'bg-muted-foreground'
                          )} />
                          <span>{r.name}</span>
                          <span className="text-xs text-muted-foreground">
                            ({r.status === 'ONLINE' ? 'En ligne' : 'Hors ligne'})
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Info Card */}
          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Informations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Créé le</p>
                  <p className="text-sm">{format(new Date(server.createdAt), "dd MMMM yyyy 'à' HH:mm", { locale: fr })}</p>
                </div>
              </div>

              {server.updatedAt && (
                <div className="flex items-start gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Modifié</p>
                    <p className="text-sm">{formatDistanceToNow(new Date(server.updatedAt), { addSuffix: true, locale: fr })}</p>
                  </div>
                </div>
              )}

              <Separator />

              <div className="pt-1">
                <p className="text-[10px] text-muted-foreground/60 font-mono break-all">
                  ID: {server.id}
                </p>
                {server.runnerId && (
                  <p className="text-[10px] text-muted-foreground/60 font-mono break-all mt-1">
                    Runner: {server.runnerId}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Orders History */}
        <div className="lg:col-span-2">
          <Card className="glass-panel h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-primary" />
                <CardTitle className="text-sm font-medium">Historique des commandes</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {server.runnerId ? (
                <OrdersHistory runnerId={server.runnerId} />
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Terminal className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <h3 className="text-sm font-medium mb-1">Aucun agent associé</h3>
                  <p className="text-xs max-w-xs mx-auto">
                    Associez un agent à ce serveur pour voir l'historique des commandes exécutées.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
