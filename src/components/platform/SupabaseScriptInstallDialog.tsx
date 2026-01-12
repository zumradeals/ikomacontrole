import { useState, useEffect, useRef } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Database, Globe, Loader2, Play, CheckCircle2, XCircle, AlertTriangle, Terminal, Mail } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useCreateOrder, Order } from '@/hooks/useOrders';
import { supabase } from '@/integrations/supabase/client';
import { useSettings } from '@/hooks/useSettings';

const installSchema = z.object({
  domain: z
    .string()
    .trim()
    .min(1, 'Le domaine est requis')
    .max(255, 'Domaine trop long')
    .regex(
      /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/,
      'Domaine invalide (ex: supabase.example.com)'
    ),
  email: z
    .string()
    .trim()
    .email('Email invalide')
    .max(255, 'Email trop long')
    .optional()
    .or(z.literal('')),
});

type InstallFormValues = z.infer<typeof installSchema>;

interface SupabaseScriptInstallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  runnerId: string;
  infrastructureId?: string;
  onComplete?: () => void;
}

type InstallPhase = 'form' | 'running' | 'completed' | 'failed';

export function SupabaseScriptInstallDialog({
  open,
  onOpenChange,
  runnerId,
  infrastructureId,
  onComplete,
}: SupabaseScriptInstallDialogProps) {
  const [phase, setPhase] = useState<InstallPhase>('form');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [logs, setLogs] = useState<string>('');
  const [order, setOrder] = useState<Order | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const createOrder = useCreateOrder();
  const { getSetting } = useSettings();

  const form = useForm<InstallFormValues>({
    resolver: zodResolver(installSchema),
    defaultValues: {
      domain: '',
      email: '',
    },
  });

  // Poll order status when running
  useEffect(() => {
    if (!orderId || phase !== 'running') return;

    const pollInterval = setInterval(async () => {
      const { data } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (data) {
        setOrder(data as Order);
        
        // Update logs from stdout/stderr
        let newLogs = '';
        if (data.stdout_tail) newLogs += data.stdout_tail;
        if (data.stderr_tail) newLogs += '\n' + data.stderr_tail;
        if (newLogs) setLogs(newLogs);

        // Check final status
        if (data.status === 'completed') {
          setPhase('completed');
          clearInterval(pollInterval);
          onComplete?.();
        } else if (data.status === 'failed') {
          setPhase('failed');
          clearInterval(pollInterval);
        }
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [orderId, phase, onComplete]);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setPhase('form');
        setOrderId(null);
        setLogs('');
        setOrder(null);
        form.reset();
      }, 300);
    }
  }, [open, form]);

  const handleSubmit = async (values: InstallFormValues) => {
    // Build the command using the official script endpoint
    const baseUrl = getSetting('runner_base_url');
    const scriptUrl = baseUrl 
      ? `${baseUrl}/playbooks/supabase-installer`
      : '';
    
    const command = `export SUPABASE_DOMAIN="${values.domain}" && export SUPABASE_EMAIL="${values.email || 'admin@localhost'}" && curl -sSL "${scriptUrl}" | bash`;

    try {
      const result = await createOrder.mutateAsync({
        runner_id: runnerId,
        infrastructure_id: infrastructureId,
        category: 'installation',
        name: 'Supabase Self-Hosted (Script Officiel)',
        description: `[supabase.selfhost.install_full] Installation via script officiel v3.21 - Domaine: ${values.domain}`,
        command,
      });

      setOrderId(result.id);
      setPhase('running');
      setLogs('🚀 Démarrage de l\'installation Supabase...\n');
    } catch (error) {
      console.error('Failed to create order:', error);
    }
  };

  const getStatusBadge = () => {
    switch (phase) {
      case 'running':
        return (
          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            En cours
          </Badge>
        );
      case 'completed':
        return (
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Terminé
          </Badge>
        );
      case 'failed':
        return (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
            <XCircle className="w-3 h-3 mr-1" />
            Échec
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="w-5 h-5 text-primary" />
            Installer Supabase (Script Officiel v3.21)
            {getStatusBadge()}
          </DialogTitle>
          <DialogDescription>
            Installation complète avec Docker, génération des secrets, et configuration automatique.
          </DialogDescription>
        </DialogHeader>

        {phase === 'form' && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              {/* Domain */}
              <FormField
                control={form.control}
                name="domain"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Domaine *</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="supabase.example.com"
                          className="pl-10"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormDescription>
                      Ce domaine doit pointer vers ce serveur (A record vers l'IP du VPS)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Email (optional) */}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email (optionnel)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="admin@example.com"
                          className="pl-10"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormDescription>
                      Email pour les notifications SSL (optionnel)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Info box */}
              <div className="rounded-lg border border-border p-4 bg-muted/50 space-y-2">
                <p className="text-sm font-medium">Ce script va :</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Installer Docker et Docker Compose si nécessaire</li>
                  <li>• Cloner le repository officiel Supabase</li>
                  <li>• Générer des secrets JWT sécurisés</li>
                  <li>• Configurer l'environnement avec votre domaine</li>
                  <li>• Démarrer tous les services (DB, Auth, REST, Realtime, Storage, Studio)</li>
                  <li>• Afficher les credentials à la fin</li>
                </ul>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Annuler
                </Button>
                <Button 
                  type="submit" 
                  disabled={createOrder.isPending}
                >
                  {createOrder.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Création...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Lancer l'installation
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        )}

        {(phase === 'running' || phase === 'completed' || phase === 'failed') && (
          <div className="flex-1 flex flex-col min-h-0 space-y-4">
            {/* Progress info */}
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Logs d'exécution</span>
              </div>
              {order?.exit_code !== null && order?.exit_code !== undefined && (
                <span className={`font-mono text-xs ${order.exit_code === 0 ? 'text-green-400' : 'text-red-400'}`}>
                  exit code: {order.exit_code}
                </span>
              )}
            </div>

            {/* Logs area */}
            <ScrollArea className="flex-1 min-h-[300px] max-h-[400px] rounded-lg border border-border bg-black/50 p-4">
              <pre className="text-xs font-mono text-green-400 whitespace-pre-wrap">
                {logs || 'En attente des logs...'}
              </pre>
              <div ref={logsEndRef} />
            </ScrollArea>

            {/* Error message */}
            {phase === 'failed' && order?.error_message && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5" />
                  <div className="text-sm text-red-400">
                    <p className="font-medium">Erreur :</p>
                    <p className="mt-1 font-mono text-xs">{order.error_message}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Success message */}
            {phase === 'completed' && (
              <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5" />
                  <div className="text-sm text-green-400">
                    <p className="font-medium">Installation terminée avec succès !</p>
                    <p className="mt-1 text-green-300/80">
                      Les credentials sont affichés dans les logs ci-dessus. 
                      Sauvegardez-les précieusement.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3">
              {phase === 'running' ? (
                <Button variant="outline" disabled>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Installation en cours...
                </Button>
              ) : (
                <Button onClick={() => onOpenChange(false)}>
                  Fermer
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
