import { Layers, Database, Zap, Globe, BarChart3 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

const services = [
  { id: 'supabase', name: 'Supabase', icon: Database, status: 'not_installed' },
  { id: 'redis', name: 'Redis', icon: Zap, status: 'not_installed' },
  { id: 'caddy', name: 'Caddy', icon: Globe, status: 'not_installed' },
  { id: 'prometheus', name: 'Prometheus', icon: BarChart3, status: 'not_installed' },
];

const Platform = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Platform"
        description="Services plateforme : Supabase, Redis, Caddy, Monitoring"
        icon={Layers}
      />

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="glass-panel p-1">
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="platforms">Plateformes</TabsTrigger>
          <TabsTrigger value="network">Réseau</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {services.map((service) => {
              const Icon = service.icon;
              return (
                <div
                  key={service.id}
                  className="glass-panel rounded-xl p-5 cursor-pointer hover:scale-[1.02] transition-all"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                      <Icon className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <span className="status-dot status-offline" />
                  </div>
                  <h3 className="font-semibold">{service.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">Non installé</p>
                </div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="platforms">
          <div className="glass-panel rounded-xl p-5">
            <p className="text-muted-foreground text-center py-8">
              Sélectionnez un runner pour installer les services plateforme
            </p>
          </div>
        </TabsContent>

        <TabsContent value="network">
          <div className="glass-panel rounded-xl p-5">
            <p className="text-muted-foreground text-center py-8">
              Configuration réseau et routes
            </p>
          </div>
        </TabsContent>

        <TabsContent value="monitoring">
          <div className="glass-panel rounded-xl p-5">
            <p className="text-muted-foreground text-center py-8">
              Métriques et alertes
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Platform;
