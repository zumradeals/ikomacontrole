import { Eye, Radio, Activity, Filter, Download, Pause, Play, Clock, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAppMode } from '@/contexts/AppModeContext';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const liveStats = [
  { label: 'En queue', value: 0, icon: Clock, color: 'text-muted-foreground' },
  { label: 'En cours', value: 0, icon: Loader2, color: 'text-primary', animate: true },
  { label: 'Appliqués', value: 0, icon: CheckCircle2, color: 'text-success' },
  { label: 'Échoués', value: 0, icon: XCircle, color: 'text-destructive' },
];

const Observability = () => {
  const { isExpert } = useAppMode();
  const [isPaused, setIsPaused] = useState(false);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Observabilité"
        description="Suivi temps réel et journal d'activité"
        icon={Eye}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant={isPaused ? "default" : "outline"}
              size="sm"
              onClick={() => setIsPaused(!isPaused)}
            >
              {isPaused ? (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Reprendre
                </>
              ) : (
                <>
                  <Pause className="w-4 h-4 mr-2" />
                  Pause
                </>
              )}
            </Button>
            {isExpert && (
              <>
                <Button variant="outline" size="sm">
                  <Filter className="w-4 h-4 mr-2" />
                  Filtrer
                </Button>
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Exporter
                </Button>
              </>
            )}
          </div>
        }
      />

      <Tabs defaultValue="live" className="space-y-6">
        <TabsList className="glass-panel">
          <TabsTrigger value="live" className="gap-2">
            <Radio className="w-4 h-4" />
            Temps Réel
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-2">
            <Activity className="w-4 h-4" />
            Historique
          </TabsTrigger>
        </TabsList>

        {/* Live Tab */}
        <TabsContent value="live" className="space-y-6">
          {/* Live Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {liveStats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="glass-panel rounded-xl p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <Icon className={cn(
                      "w-5 h-5",
                      stat.color,
                      stat.animate && "animate-spin"
                    )} />
                    <span className="text-sm text-muted-foreground">{stat.label}</span>
                  </div>
                  <p className="text-3xl font-bold font-mono">{stat.value}</p>
                </div>
              );
            })}
          </div>

          {/* Live Feed */}
          <div className="glass-panel rounded-xl p-5 glow-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Radio className={cn(
                  "w-4 h-4 text-primary",
                  !isPaused && "animate-pulse-glow"
                )} />
                Ordres en Direct
              </h3>
              {!isPaused && (
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="status-dot status-online" />
                  Connecté
                </span>
              )}
            </div>

            <div className="text-center py-12 text-muted-foreground">
              <Radio className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Aucun ordre en cours</p>
              <p className="text-sm mt-2">
                Les ordres apparaîtront ici en temps réel
              </p>
            </div>
          </div>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-6">
          <div className="glass-panel rounded-xl p-5">
            <div className="text-center py-12 text-muted-foreground">
              <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Aucune activité récente</p>
              <p className="text-sm mt-2">
                Les événements système apparaîtront ici
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Observability;
