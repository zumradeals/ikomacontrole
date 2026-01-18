import { Server, Trash2, Link2, Link2Off, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { ProxyServer, ProxyRunner } from '@/hooks/useApiServers';

interface ServerCardProps {
  server: ProxyServer;
  runner: ProxyRunner | null;
  runners: ProxyRunner[];
  onRunnerChange: (runnerId: string | null) => void;
  onDelete: () => void;
  isUpdating?: boolean;
}

export function ServerCard({
  server,
  runner,
  runners,
  onRunnerChange,
  onDelete,
  isUpdating,
}: ServerCardProps) {
  const hasRunner = !!server.runnerId;

  // Sort runners: ONLINE first, then by name
  const sortedRunners = [...runners].sort((a, b) => {
    if (a.status === 'ONLINE' && b.status !== 'ONLINE') return -1;
    if (a.status !== 'ONLINE' && b.status === 'ONLINE') return 1;
    return a.name.localeCompare(b.name);
  });

  const handleSelectChange = (value: string) => {
    if (value === '__none__') {
      onRunnerChange(null);
    } else {
      onRunnerChange(value);
    }
  };

  return (
    <Card className="glass-panel hover:border-primary/30 transition-all group">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Server className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base font-medium">{server.name}</CardTitle>
              {server.host && (
                <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                  {server.host}
                </p>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={onDelete}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status */}
        <div className="flex items-center gap-2">
          <Badge 
            variant={hasRunner ? 'default' : 'secondary'}
            className={cn(
              hasRunner && 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
            )}
          >
            {hasRunner ? (
              <>
                <Link2 className="w-3 h-3 mr-1" />
                Associé
              </>
            ) : (
              <>
                <Link2Off className="w-3 h-3 mr-1" />
                Non associé
              </>
            )}
          </Badge>

          {runner && (
            <Badge 
              variant="outline"
              className={cn(
                runner.status === 'ONLINE' && 'border-emerald-500/30 text-emerald-500',
                runner.status === 'OFFLINE' && 'border-muted-foreground/30 text-muted-foreground'
              )}
            >
              <Activity className={cn(
                'w-3 h-3 mr-1',
                runner.status === 'ONLINE' && 'animate-pulse'
              )} />
              {runner.status}
            </Badge>
          )}
        </div>

        {/* Runner info */}
        {runner && (
          <div className="text-sm">
            <span className="text-muted-foreground">Runner: </span>
            <span className="font-medium">{runner.name}</span>
          </div>
        )}

        {/* Runner Select */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            Runner associé
          </label>
          <Select
            value={server.runnerId || '__none__'}
            onValueChange={handleSelectChange}
            disabled={isUpdating}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Sélectionner un runner..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">
                <span className="text-muted-foreground">Aucun (dissocier)</span>
              </SelectItem>
              {sortedRunners.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  <div className="flex items-center gap-2">
                    <span 
                      className={cn(
                        'w-2 h-2 rounded-full',
                        r.status === 'ONLINE' ? 'bg-emerald-500' : 'bg-muted-foreground'
                      )} 
                    />
                    <span>{r.name}</span>
                    <span className="text-xs text-muted-foreground">({r.status})</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Server ID (debug) */}
        <div className="pt-2 border-t border-border/50">
          <p className="text-xs text-muted-foreground font-mono truncate">
            ID: {server.id}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
