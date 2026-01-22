/**
 * ORDER REPORT VIEW
 * 
 * Displays the reportContract from the API faithfully.
 * This component is PASSIVE - it only displays data, no interpretation.
 * 
 * The reportContract is the source of truth for execution details.
 */

import { CheckCircle2, XCircle, Clock, Loader2, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { ReportContract, ReportContractStep } from '@/lib/api/ordersAdminProxy';

interface OrderReportViewProps {
  reportContract: ReportContract;
  className?: string;
}

const stepStatusConfig: Record<ReportContractStep['status'], {
  icon: React.ReactNode;
  label: string;
  color: string;
  bgColor: string;
}> = {
  PENDING: {
    icon: <Clock className="w-3.5 h-3.5" />,
    label: 'En attente',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/30',
  },
  RUNNING: {
    icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
    label: 'En cours',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
  },
  SUCCESS: {
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    label: 'Succès',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
  },
  FAILED: {
    icon: <XCircle className="w-3.5 h-3.5" />,
    label: 'Échec',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
  },
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

function StepItem({ step }: { step: ReportContractStep }) {
  const config = stepStatusConfig[step.status] ?? stepStatusConfig.PENDING;
  
  return (
    <div className={cn(
      "rounded-md border p-2.5 space-y-1.5",
      step.status === 'FAILED' && "border-red-500/30 bg-red-500/5",
      step.status === 'SUCCESS' && "border-emerald-500/30",
      step.status === 'RUNNING' && "border-blue-500/30 bg-blue-500/5",
    )}>
      <div className="flex items-center gap-2">
        <div className={cn("p-1 rounded", config.bgColor, config.color)}>
          {config.icon}
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium truncate block">{step.title}</span>
          <span className="text-[10px] font-mono text-muted-foreground">{step.key}</span>
        </div>
        <Badge variant="outline" className={cn("text-[10px]", config.color)}>
          {config.label}
        </Badge>
      </div>
      
      {/* Step output */}
      {step.output && (
        <pre className="text-xs font-mono bg-background/50 p-1.5 rounded whitespace-pre-wrap max-h-20 overflow-y-auto">
          {step.output}
        </pre>
      )}
      
      {/* Step error */}
      {step.error && (
        <pre className="text-xs font-mono bg-red-500/10 text-red-300 p-1.5 rounded whitespace-pre-wrap max-h-20 overflow-y-auto">
          {step.error}
        </pre>
      )}
    </div>
  );
}

export function OrderReportView({ reportContract, className }: OrderReportViewProps) {
  const { version, summary, durationMs, steps, errors } = reportContract;
  
  return (
    <div className={cn("space-y-3", className)}>
      {/* Header with version and duration */}
      <div className="flex items-center justify-between text-xs">
        <Badge variant="outline" className="font-mono text-[10px]">
          report_contract {version}
        </Badge>
        {durationMs !== undefined && (
          <span className="text-muted-foreground">
            Durée: <span className="font-mono">{formatDuration(durationMs)}</span>
          </span>
        )}
      </div>
      
      {/* Summary */}
      {summary && (
        <div className="text-sm text-muted-foreground bg-muted/20 rounded-md p-2">
          {summary}
        </div>
      )}
      
      {/* Steps */}
      {steps && steps.length > 0 && (
        <div>
          <p className="text-[10px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">
            Étapes ({steps.length})
          </p>
          <ScrollArea className="max-h-64">
            <div className="space-y-1.5 pr-2">
              {steps.map((step, index) => (
                <StepItem key={step.key || index} step={step} />
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
      
      {/* Errors */}
      {errors && errors.length > 0 && (
        <div>
          <p className="text-[10px] font-medium text-red-400 mb-1.5 uppercase tracking-wider flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Erreurs ({errors.length})
          </p>
          <div className="space-y-1.5">
            {errors.map((err, index) => (
              <div key={index} className="rounded-md border border-red-500/30 bg-red-500/5 p-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] font-mono text-red-400 border-red-500/30">
                    {err.code}
                  </Badge>
                </div>
                <p className="text-xs text-red-300 mt-1">{err.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
