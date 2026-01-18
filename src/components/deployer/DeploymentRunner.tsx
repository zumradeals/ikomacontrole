/**
 * DEPLOYMENT RUNNER
 * 
 * NOTE: This component polls the local Supabase 'orders' table to track step execution.
 * This is intentional - orders are created and managed by this control plane.
 * The 'orders' table IS the source of truth for order execution state.
 * 
 * The 'deployment_steps' table is also local and managed by this control plane.
 */

import { useState, useEffect, useRef } from 'react';
import { 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Play,
  Terminal,
  AlertTriangle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  useDeployment, 
  useDeploymentSteps, 
  useUpdateDeployment,
  Deployment,
  DeploymentStep,
} from '@/hooks/useDeployments';
import { useCreateOrder } from '@/hooks/useOrders';
import { supabase } from '@/integrations/supabase/client';

interface DeploymentRunnerProps {
  deploymentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeploymentRunner({ deploymentId, open, onOpenChange }: DeploymentRunnerProps) {
  const { data: deployment, refetch: refetchDeployment } = useDeployment(deploymentId);
  const { data: steps, refetch: refetchSteps } = useDeploymentSteps(deploymentId);
  const updateDeployment = useUpdateDeployment();
  const createOrder = useCreateOrder();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Poll for step updates when running
  useEffect(() => {
    if (!isRunning || !deploymentId) return;

    const interval = setInterval(async () => {
      await refetchSteps();
      await refetchDeployment();
    }, 2000);

    return () => clearInterval(interval);
  }, [isRunning, deploymentId, refetchSteps, refetchDeployment]);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [steps]);

  // Check for completion
  useEffect(() => {
    if (!steps || !isRunning) return;

    const allDone = steps.every(s => s.status === 'applied' || s.status === 'failed' || s.status === 'skipped');
    const anyFailed = steps.some(s => s.status === 'failed');

    if (allDone) {
      setIsRunning(false);
      if (deployment) {
        updateDeployment.mutate({
          id: deployment.id,
          status: anyFailed ? 'failed' : 'applied',
          completed_at: new Date().toISOString(),
          error_message: anyFailed ? 'Une ou plusieurs étapes ont échoué' : null,
        });
      }
    }
  }, [steps, isRunning, deployment]);

  const executeStep = async (step: DeploymentStep) => {
    if (!deployment) return;

    // Update step status to running
    await supabase
      .from('deployment_steps')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', step.id);

    // Create order for this step
    const order = await createOrder.mutateAsync({
      runner_id: deployment.runner_id,
      infrastructure_id: deployment.infrastructure_id || undefined,
      category: 'installation',
      name: `[deploy] ${step.step_name}`,
      description: `[deploy.${step.step_type}] Deployment: ${deployment.app_name}`,
      command: step.command,
    });

    // Link order to step
    await supabase
      .from('deployment_steps')
      .update({ order_id: order.id })
      .eq('id', step.id);

    // Poll for order completion
    return new Promise<void>((resolve) => {
      const pollInterval = setInterval(async () => {
        const { data: updatedOrder } = await supabase
          .from('orders')
          .select('*')
          .eq('id', order.id)
          .single();

        if (updatedOrder && (updatedOrder.status === 'completed' || updatedOrder.status === 'failed')) {
          clearInterval(pollInterval);

          // Update step with result
          await supabase
            .from('deployment_steps')
            .update({
              status: updatedOrder.status === 'completed' ? 'applied' : 'failed',
              finished_at: new Date().toISOString(),
              exit_code: updatedOrder.exit_code,
              stdout_tail: updatedOrder.stdout_tail,
              stderr_tail: updatedOrder.stderr_tail,
              error_message: updatedOrder.error_message,
            })
            .eq('id', step.id);

          resolve();
        }
      }, 2000);
    });
  };

  const startDeployment = async () => {
    if (!deployment || !steps) return;

    setIsRunning(true);
    setCurrentStepIndex(0);

    // Update deployment status
    await updateDeployment.mutateAsync({
      id: deployment.id,
      status: 'running',
      started_at: new Date().toISOString(),
    });

    // Execute steps sequentially
    for (let i = 0; i < steps.length; i++) {
      setCurrentStepIndex(i);
      const step = steps[i];

      try {
        await executeStep(step);
        await refetchSteps();

        // Check if step failed
        const { data: updatedStep } = await supabase
          .from('deployment_steps')
          .select('status')
          .eq('id', step.id)
          .single();

        if (updatedStep?.status === 'failed') {
          // Stop execution on failure
          break;
        }
      } catch (error) {
        console.error('Step execution error:', error);
        break;
      }
    }

    setIsRunning(false);
  };

  const getStepStatus = (step: DeploymentStep) => {
    switch (step.status) {
      case 'pending':
        return <div className="w-6 h-6 rounded-full border-2 border-muted flex items-center justify-center text-xs text-muted-foreground">{step.step_order}</div>;
      case 'running':
        return <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />;
      case 'applied':
        return <CheckCircle2 className="w-5 h-5 text-green-400" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-400" />;
      case 'skipped':
        return <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs">—</div>;
    }
  };

  if (!deployment) return null;

  const canStart = deployment.status === 'ready' || deployment.status === 'failed';
  const isComplete = deployment.status === 'applied' || deployment.status === 'failed';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-primary" />
            Déploiement: {deployment.app_name}
            <Badge className={
              deployment.status === 'applied' ? 'bg-green-500/20 text-green-400' :
              deployment.status === 'failed' ? 'bg-red-500/20 text-red-400' :
              deployment.status === 'running' ? 'bg-blue-500/20 text-blue-400' :
              'bg-muted text-muted-foreground'
            }>
              {deployment.status}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 grid grid-cols-3 gap-4 min-h-0">
          {/* Steps List */}
          <div className="col-span-1 border rounded-lg p-3">
            <h4 className="text-sm font-medium mb-3">Étapes</h4>
            <ScrollArea className="h-[400px]">
              <div className="space-y-2 pr-2">
                {steps?.map((step) => (
                  <div 
                    key={step.id} 
                    className={`flex items-center gap-2 p-2 rounded text-sm ${
                      step.status === 'running' ? 'bg-blue-500/10 border border-blue-500/30' :
                      step.status === 'failed' ? 'bg-red-500/10' :
                      step.status === 'applied' ? 'bg-green-500/10' :
                      'bg-muted/50'
                    }`}
                  >
                    {getStepStatus(step)}
                    <span className="flex-1 truncate">{step.step_name}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Logs */}
          <div className="col-span-2 border rounded-lg p-3 flex flex-col">
            <h4 className="text-sm font-medium mb-3">Logs</h4>
            <ScrollArea className="flex-1 bg-black/50 rounded p-3">
              <div className="space-y-3">
                {steps?.filter(s => s.stdout_tail || s.stderr_tail || s.error_message).map((step) => (
                  <div key={step.id} className="font-mono text-xs">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      {getStepStatus(step)}
                      <span>{step.step_name}</span>
                      {step.exit_code !== null && (
                        <span className={step.exit_code === 0 ? 'text-green-400' : 'text-red-400'}>
                          exit: {step.exit_code}
                        </span>
                      )}
                    </div>
                    {step.stdout_tail && (
                      <pre className="text-green-400 whitespace-pre-wrap pl-7">{step.stdout_tail}</pre>
                    )}
                    {step.stderr_tail && (
                      <pre className="text-yellow-400 whitespace-pre-wrap pl-7">{step.stderr_tail}</pre>
                    )}
                    {step.error_message && (
                      <pre className="text-red-400 whitespace-pre-wrap pl-7">{step.error_message}</pre>
                    )}
                  </div>
                ))}
                {isRunning && steps?.every(s => !s.stdout_tail && !s.stderr_tail) && (
                  <div className="text-muted-foreground">En attente des logs...</div>
                )}
                <div ref={logsEndRef} />
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Error message */}
        {deployment.error_message && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5" />
            <p className="text-sm text-red-400">{deployment.error_message}</p>
          </div>
        )}

        {/* Success message */}
        {deployment.status === 'applied' && (
          <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5" />
            <div className="text-sm text-green-400">
              <p className="font-medium">Déploiement réussi !</p>
              {deployment.domain && (
                <p className="mt-1">Accessible sur: <a href={`https://${deployment.domain}`} target="_blank" className="underline">{deployment.domain}</a></p>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          {canStart && (
            <Button onClick={startDeployment} disabled={isRunning}>
              {isRunning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Exécution en cours...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  {deployment.status === 'failed' ? 'Relancer' : 'Lancer le déploiement'}
                </>
              )}
            </Button>
          )}
          {isComplete && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fermer
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
