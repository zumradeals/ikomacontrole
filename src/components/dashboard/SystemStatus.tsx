import { Server, Activity, CheckCircle2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatusMetric {
  label: string;
  value: string | number;
  status: 'online' | 'warning' | 'error' | 'neutral';
  icon: typeof Server;
}

const metrics: StatusMetric[] = [
  { label: 'Runners Actifs', value: 0, status: 'neutral', icon: Server },
  { label: 'Ordres en Queue', value: 0, status: 'neutral', icon: Activity },
  { label: 'Déploiements', value: 0, status: 'neutral', icon: CheckCircle2 },
  { label: 'Alertes', value: 0, status: 'neutral', icon: AlertTriangle },
];

const statusStyles = {
  online: 'glow-border-success text-success',
  warning: 'glow-border-warning text-warning',
  error: 'glow-border-error text-destructive',
  neutral: 'text-muted-foreground',
};

export function SystemStatus() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <div
            key={metric.label}
            className={cn(
              "glass-panel rounded-xl p-4 transition-all hover:scale-[1.02]",
              metric.status !== 'neutral' && statusStyles[metric.status]
            )}
          >
            <div className="flex items-center justify-between mb-3">
              <Icon className={cn(
                "w-5 h-5",
                metric.status === 'neutral' ? 'text-muted-foreground' : ''
              )} />
              {metric.status !== 'neutral' && (
                <span className={cn(
                  "status-dot",
                  `status-${metric.status}`
                )} />
              )}
            </div>
            <p className="text-2xl font-bold font-mono">{metric.value}</p>
            <p className="text-sm text-muted-foreground mt-1">{metric.label}</p>
          </div>
        );
      })}
    </div>
  );
}
