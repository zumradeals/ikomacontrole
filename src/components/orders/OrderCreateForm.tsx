/**
 * Order Create Form Component
 * 
 * Formulaire de création d'ordre aligné sur le moteur IKOMA:
 * - serverId, playbookKey, action, createdBy
 * - Polling jusqu'à SUCCEEDED/FAILED
 * - Affichage du rapport si présent
 */

import { useState, useEffect, useRef } from 'react';
import { Send, RefreshCw, StopCircle, CheckCircle2, XCircle, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createOrder, getOrder, type IkomaOrder } from '@/lib/api/ikomaApi';
import { listServers, type ProxyServer } from '@/lib/api/ordersAdminProxy';
import { usePlaybooks } from '@/hooks/usePlaybooks';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface OrderCreateFormProps {
  onOrderCreated?: (order: IkomaOrder) => void;
}

export function OrderCreateForm({ onOrderCreated }: OrderCreateFormProps) {
  const [servers, setServers] = useState<ProxyServer[]>([]);
  const [serverId, setServerId] = useState('');
  const [playbookKey, setPlaybookKey] = useState('');
  const [action, setAction] = useState('run');
  const [createdBy, setCreatedBy] = useState('dashboard');
  
  const [submitting, setSubmitting] = useState(false);
  const [polling, setPolling] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<IkomaOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Charger les playbooks depuis l'API (source de vérité unique)
  const { data: playbooks, isLoading: playbooksLoading, error: playbooksError } = usePlaybooks();

  // Charger les serveurs
  useEffect(() => {
    async function loadServers() {
      const result = await listServers();
      if (result.success && result.data) {
        setServers(result.data);
      }
    }
    loadServers();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!serverId || !playbookKey) {
      toast.error('Veuillez remplir tous les champs requis');
      return;
    }

    setError(null);
    setSubmitting(true);
    setCurrentOrder(null);

    const result = await createOrder({
      serverId,
      playbookKey,
      action,
      createdBy,
    });

    if (!result.success) {
      setError(result.error?.message || 'Erreur lors de la création');
      setSubmitting(false);
      toast.error(result.error?.message || 'Erreur');
      return;
    }

    const order = result.data!;
    setCurrentOrder(order);
    toast.success(`Ordre créé: ${order.id}`);
    onOrderCreated?.(order);

    // Start polling
    startPolling(order.id);
  };

  const startPolling = (orderId: string) => {
    setPolling(true);
    
    pollingRef.current = setInterval(async () => {
      const orderResult = await getOrder(orderId);
      
      if (!orderResult.success) {
        console.warn('Polling error:', orderResult.error);
        return;
      }

      setCurrentOrder(orderResult.data!);

      const status = orderResult.data!.status;
      if (status === 'SUCCEEDED' || status === 'FAILED' || status === 'CANCELLED') {
        stopPolling();
        
        if (status === 'SUCCEEDED') {
          toast.success('Ordre exécuté avec succès');
        } else if (status === 'FAILED') {
          toast.error('Ordre échoué');
        }
      }
    }, 2000);
  };

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setPolling(false);
    setSubmitting(false);
  };

  const getStatusDisplay = (status: string) => {
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
          <Send className="w-5 h-5 text-primary" />
          Créer un Ordre
        </CardTitle>
        <CardDescription>
          Envoyer une commande à un serveur via le moteur IKOMA
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Server Selection */}
          <div className="space-y-2">
            <Label htmlFor="order-serverId">Server ID *</Label>
            {servers.length > 0 ? (
              <Select value={serverId} onValueChange={setServerId}>
                <SelectTrigger id="order-serverId">
                  <SelectValue placeholder="Sélectionner un serveur" />
                </SelectTrigger>
                <SelectContent>
                  {servers.map((server) => (
                    <SelectItem key={server.id} value={server.id}>
                      {server.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="order-serverId"
                placeholder="UUID du serveur"
                value={serverId}
                onChange={(e) => setServerId(e.target.value)}
              />
            )}
          </div>

          {/* Playbook Selection - Source dynamique depuis API */}
          <div className="space-y-2">
            <Label htmlFor="order-playbook">Playbook Key *</Label>
            {playbooksLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Chargement des playbooks...
              </div>
            ) : playbooksError ? (
              <div className="text-destructive text-sm py-2">
                Erreur: {playbooksError instanceof Error ? playbooksError.message : 'Chargement échoué'}
              </div>
            ) : (
              <Select value={playbookKey} onValueChange={(key) => {
                setPlaybookKey(key);
                // Auto-set action from playbook schema
                const pb = playbooks?.find(p => p.key === key);
                if (pb?.actions?.length) {
                  setAction(pb.actions[0]);
                }
              }}>
                <SelectTrigger id="order-playbook">
                  <SelectValue placeholder="Sélectionner un playbook" />
                </SelectTrigger>
                <SelectContent>
                  {playbooks?.map((pb) => (
                    <SelectItem key={pb.key} value={pb.key}>
                      <div className="flex flex-col">
                        <span>{pb.title}</span>
                        <span className="text-xs text-muted-foreground">{pb.key}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {playbookKey && playbooks && (
              <p className="text-xs text-muted-foreground">
                {playbooks.find(p => p.key === playbookKey)?.description}
              </p>
            )}
          </div>

          {/* Action */}
          <div className="space-y-2">
            <Label htmlFor="order-action">Action</Label>
            <Input
              id="order-action"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              placeholder="execute"
            />
          </div>

          {/* Created By */}
          <div className="space-y-2">
            <Label htmlFor="order-createdBy">Created By</Label>
            <Input
              id="order-createdBy"
              value={createdBy}
              onChange={(e) => setCreatedBy(e.target.value)}
              placeholder="dashboard"
            />
          </div>

          {/* Submit Button */}
          <div className="flex gap-2">
            <Button type="submit" disabled={submitting || !serverId || !playbookKey}>
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  En cours...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Créer l'ordre
                </>
              )}
            </Button>
            {polling && (
              <Button type="button" variant="outline" onClick={stopPolling}>
                <StopCircle className="w-4 h-4 mr-2" />
                Arrêter le polling
              </Button>
            )}
          </div>
        </form>

        {/* Error Display */}
        {error && (
          <div className="flex items-center gap-2 p-3 mt-4 rounded-lg bg-destructive/10 text-destructive">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Order Result */}
        {currentOrder && (
          <div className="mt-6 p-4 border rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Order ID</p>
                <code className="text-xs text-muted-foreground">{currentOrder.id}</code>
              </div>
              {getStatusDisplay(currentOrder.status)}
            </div>

            {currentOrder.report && (
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-2">Rapport</p>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant={currentOrder.report.ok ? 'default' : 'destructive'}>
                    {currentOrder.report.ok ? 'OK' : 'FAIL'}
                  </Badge>
                  {currentOrder.report.durationMs && (
                    <span className="text-xs text-muted-foreground">
                      {currentOrder.report.durationMs}ms
                    </span>
                  )}
                </div>
                {currentOrder.report.summary && (
                  <p className="text-sm">{currentOrder.report.summary}</p>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
