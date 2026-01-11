import { LayoutDashboard, Server, HardDrive, Layers, Rocket } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { SystemStatus } from '@/components/dashboard/SystemStatus';
import { ModuleCard } from '@/components/dashboard/ModuleCard';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { QuickActions } from '@/components/dashboard/QuickActions';

const modules = [
  {
    title: 'Runners',
    description: 'Gérer les agents déployés sur vos serveurs VPS',
    icon: Server,
    path: '/runner',
    status: 'inactive' as const,
    count: 0,
  },
  {
    title: 'Infrastructure',
    description: 'Registre et configuration de vos serveurs',
    icon: HardDrive,
    path: '/infra',
    status: 'inactive' as const,
    count: 0,
  },
  {
    title: 'Platform',
    description: 'Services plateforme : Supabase, Redis, Caddy',
    icon: Layers,
    path: '/platform',
    status: 'inactive' as const,
  },
  {
    title: 'Deployer',
    description: 'Déploiement et orchestration de vos applications',
    icon: Rocket,
    path: '/deployer',
    status: 'inactive' as const,
    count: 0,
  },
];

const Index = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Dashboard"
        description="Vue d'ensemble du Control Plane IKOMA"
        icon={LayoutDashboard}
      />

      {/* System Status Metrics */}
      <SystemStatus />

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Modules Grid */}
        <div className="lg:col-span-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {modules.map((module) => (
              <ModuleCard key={module.path} {...module} />
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <QuickActions />
          <ActivityFeed />
        </div>
      </div>
    </div>
  );
};

export default Index;
