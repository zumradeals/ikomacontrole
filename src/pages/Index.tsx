import { LayoutDashboard, Server, HardDrive, Terminal, Rocket } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { SystemStatus } from '@/components/dashboard/SystemStatus';
import { ModuleCard } from '@/components/dashboard/ModuleCard';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { OnboardingBanner } from '@/components/dashboard/OnboardingBanner';
import { ApiStatusWidget } from '@/components/dashboard/ApiStatusWidget';

const modules = [
  {
    title: 'Serveurs',
    description: 'Registre et configuration de vos serveurs',
    icon: HardDrive,
    path: '/infra',
    status: 'inactive' as const,
    count: 0,
  },
  {
    title: 'Agents',
    description: 'Agents déployés sur vos serveurs',
    icon: Server,
    path: '/runner',
    status: 'inactive' as const,
    count: 0,
  },
  {
    title: 'Playbooks',
    description: 'Catalogue de scripts d\'automatisation',
    icon: Terminal,
    path: '/playbooks',
    status: 'inactive' as const,
  },
  {
    title: 'Déploiements',
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

      {/* Onboarding Banner */}
      <OnboardingBanner />

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
          {/* API Status Widget */}
          <ApiStatusWidget />
          
          <QuickActions />
          <ActivityFeed />
        </div>
      </div>
    </div>
  );
};

export default Index;
