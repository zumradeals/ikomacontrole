import { Server, Activity, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { Skeleton } from '@/components/ui/skeleton';

interface StatusMetric {
  label: string;
  value: string | number;
  status: 'online' | 'warning' | 'error' | 'neutral';
  icon: typeof Server;
}

const statusStyles = {
  online: 'glow-border-success text-success',
  warning: 'glow-border-warning text-warning',
  error: 'glow-border-error text-destructive',
  neutral: 'text-muted-foreground',
};

export function SystemStatus() {
  const { data: stats, isLoading, error, dataUpdatedAt } = useDashboardStats();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  if (error || !stats) {
    // Fallback to neutral state when API not configured
    const fallbackMetrics: StatusMetric[] = [
      { label: 'Runners Actifs', value: '-', status: 'neutral', icon: Server },
      { label: 'Ordres en Queue', value: '-', status: 'neutral', icon: Activity },
      { label: 'Complétés (24h)', value: '-', status: 'neutral', icon: CheckCircle2 },
      { label: 'Échecs (24h)', value: '-', status: 'neutral', icon: AlertTriangle },
    ];

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {fallbackMetrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div
              key={metric.label}
              className="glass-panel rounded-xl p-4 transition-all hover:scale-[1.02] opacity-60"
            >
              <div className="flex items-center justify-between mb-3">
                <Icon className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold font-mono">{metric.value}</p>
              <p className="text-sm text-muted-foreground mt-1">{metric.label}</p>
            </div>
          );
        })}
      </div>
    );
  }

  const metrics: StatusMetric[] = [
    { 
      label: 'Runners Actifs', 
      value: `${stats.runners.online}/${stats.runners.total}`, 
      status: stats.runners.online > 0 ? 'online' : (stats.runners.total > 0 ? 'warning' : 'neutral'),
      icon: Server 
    },
    { 
      label: 'Ordres en Queue', 
      value: stats.orders.queue, 
      status: stats.orders.running > 0 ? 'warning' : 'neutral',
      icon: Activity 
    },
    { 
      label: 'Complétés (24h)', 
      value: stats.orders.completed_24h, 
      status: stats.orders.completed_24h > 0 ? 'online' : 'neutral',
      icon: CheckCircle2 
    },
    { 
      label: 'Échecs (24h)', 
      value: stats.orders.failed_24h, 
      status: stats.orders.failed_24h > 0 ? 'error' : 'neutral',
      icon: AlertTriangle 
    },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
        <RefreshCw className="w-3 h-3" />
        <span>
          Mis à jour: {new Date(dataUpdatedAt).toLocaleTimeString()}
        </span>
      </div>
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
    </div>
  );
}
