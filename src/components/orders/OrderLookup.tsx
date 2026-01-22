/**
 * Order Lookup Component
 * 
 * Recherche d'ordre par ID avec GET /v1/orders/:id
 */

import { useState } from 'react';
import { Search, RefreshCw, CheckCircle2, XCircle, Clock, StopCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getOrder, type IkomaOrder, type ReportV1Step } from '@/lib/api/ikomaApi';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function OrderLookup() {
  const [orderId, setOrderId] = useState('');
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<IkomaOrder | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!orderId.trim()) {
      toast.error('Veuillez saisir un Order ID');
      return;
    }

    setError(null);
    setLoading(true);
    setOrder(null);

    const result = await getOrder(orderId.trim());

    setLoading(false);

    if (!result.success) {
      setError(result.error?.message || 'Ordre non trouvé');
      toast.error(result.error?.message || 'Erreur');
      return;
    }

    setOrder(result.data!);
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof Clock; label: string; className?: string }> = {
      QUEUED: { variant: 'secondary', icon: Clock, label: 'En attente' },
      RUNNING: { variant: 'default', icon: RefreshCw, label: 'En cours' },
      SUCCEEDED: { variant: 'default', icon: CheckCircle2, label: 'Succès', className: 'bg-success' },
      FAILED: { variant: 'destructive', icon: XCircle, label: 'Échec' },
      CANCELLED: { variant: 'outline', icon: StopCircle, label: 'Annulé' },
    };

    const cfg = config[status] || config.QUEUED;
    const Icon = cfg.icon;

    return (
      <Badge variant={cfg.variant} className={cn('gap-1', cfg.className)}>
        <Icon className={cn('w-3 h-3', status === 'RUNNING' && 'animate-spin')} />
        {cfg.label}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="w-5 h-5 text-primary" />
          Recherche par Order ID
        </CardTitle>
        <CardDescription>
          GET /v1/orders/:id - Récupérer les détails d'un ordre
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor="lookup-orderId" className="sr-only">Order ID</Label>
            <Input
              id="lookup-orderId"
              placeholder="UUID de l'ordre"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <Button onClick={handleSearch} disabled={loading}>
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Order Details */}
        {order && (
          <div className="space-y-4 border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Order ID</p>
                <code className="text-xs">{order.id}</code>
              </div>
              {getStatusBadge(order.status)}
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Server ID</p>
                <code className="text-xs">{order.serverId}</code>
              </div>
              <div>
                <p className="text-muted-foreground">Playbook</p>
                <p className="font-mono">{order.playbookKey}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Action</p>
                <p>{order.action}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Créé le</p>
                <p>{new Date(order.createdAt).toLocaleString()}</p>
              </div>
            </div>

            {/* Report */}
            {order.report && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Rapport (v{order.report.version})</h4>
                  <Badge variant={order.report.ok ? 'default' : 'destructive'}>
                    {order.report.ok ? 'OK' : 'FAIL'}
                  </Badge>
                </div>

                {order.report.summary && (
                  <p className="text-sm bg-muted p-3 rounded-lg">{order.report.summary}</p>
                )}

                {/* Steps */}
                {order.report.steps.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Step</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Duration</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {order.report.steps.map((step, idx) => (
                        <StepRow key={idx} step={step} />
                      ))}
                    </TableBody>
                  </Table>
                )}

                {/* Errors */}
                {order.report.errors.length > 0 && (
                  <div className="space-y-2">
                    <h5 className="text-sm font-medium text-destructive">Erreurs</h5>
                    {order.report.errors.map((err, idx) => (
                      <div key={idx} className="p-2 bg-destructive/10 rounded text-sm">
                        <span className="font-mono">[{err.code}]</span> {err.message}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StepRow({ step }: { step: ReportV1Step }) {
  const statusConfig = {
    SUCCESS: { icon: CheckCircle2, className: 'text-success' },
    FAILED: { icon: XCircle, className: 'text-destructive' },
    RUNNING: { icon: RefreshCw, className: 'text-primary animate-spin' },
    PENDING: { icon: Clock, className: 'text-muted-foreground' },
    SKIPPED: { icon: AlertCircle, className: 'text-muted-foreground' },
  };

  const cfg = statusConfig[step.status] || statusConfig.PENDING;
  const Icon = cfg.icon;

  return (
    <TableRow>
      <TableCell className="font-medium">{step.name}</TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Icon className={cn('w-4 h-4', cfg.className)} />
          <span className="text-xs">{step.status}</span>
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {step.durationMs ? `${step.durationMs}ms` : '-'}
      </TableCell>
    </TableRow>
  );
}
