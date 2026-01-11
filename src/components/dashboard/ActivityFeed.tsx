import { Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ActivityItem {
  id: string;
  type: string;
  status: 'queued' | 'running' | 'applied' | 'failed';
  timestamp: string;
  target?: string;
}

const mockActivities: ActivityItem[] = [
  { id: '1', type: 'system.healthcheck', status: 'applied', timestamp: 'Il y a 2 min', target: 'runner-01' },
  { id: '2', type: 'deploy.start', status: 'running', timestamp: 'Il y a 5 min', target: 'api-prod' },
  { id: '3', type: 'network.publish', status: 'queued', timestamp: 'Il y a 8 min', target: 'app.example.com' },
];

const statusIcons = {
  queued: Clock,
  running: Loader2,
  applied: CheckCircle2,
  failed: XCircle,
};

const statusColors = {
  queued: 'text-muted-foreground',
  running: 'text-primary animate-spin',
  applied: 'text-success',
  failed: 'text-destructive',
};

export function ActivityFeed() {
  return (
    <div className="glass-panel rounded-xl p-5">
      <h3 className="font-semibold mb-4 flex items-center gap-2">
        <Clock className="w-4 h-4 text-primary" />
        Activité Récente
      </h3>
      
      <div className="space-y-3">
        {mockActivities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Aucune activité récente
          </p>
        ) : (
          mockActivities.map((activity) => {
            const Icon = statusIcons[activity.status];
            return (
              <div
                key={activity.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <Icon className={cn("w-4 h-4 shrink-0", statusColors[activity.status])} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono text-foreground truncate">
                    {activity.type}
                  </p>
                  {activity.target && (
                    <p className="text-xs text-muted-foreground truncate">
                      → {activity.target}
                    </p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {activity.timestamp}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
