import { Settings, Monitor, Users, Link2, Bell, Shield } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSettings } from '@/hooks/useSettings';
import { SettingsSystem } from '@/components/settings/SettingsSystem';
import { SettingsUsers } from '@/components/settings/SettingsUsers';
import { SettingsIntegrations } from '@/components/settings/SettingsIntegrations';
import { SettingsNotifications } from '@/components/settings/SettingsNotifications';
import { SettingsSecurity } from '@/components/settings/SettingsSecurity';

const SettingsPage = () => {
  const { isLoading } = useSettings();

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-12 w-full max-w-2xl" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Paramètres"
        description="Configuration globale du Control Plane IKOMA"
        icon={Settings}
      />

      <Tabs defaultValue="system" className="space-y-6">
        <TabsList className="glass-panel flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="system" className="gap-2">
            <Monitor className="w-4 h-4" />
            <span className="hidden sm:inline">Système</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Utilisateurs</span>
          </TabsTrigger>
          <TabsTrigger value="integrations" className="gap-2">
            <Link2 className="w-4 h-4" />
            <span className="hidden sm:inline">Intégrations</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="w-4 h-4" />
            <span className="hidden sm:inline">Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="w-4 h-4" />
            <span className="hidden sm:inline">Sécurité</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="system">
          <SettingsSystem />
        </TabsContent>

        <TabsContent value="users">
          <SettingsUsers />
        </TabsContent>

        <TabsContent value="integrations">
          <SettingsIntegrations />
        </TabsContent>

        <TabsContent value="notifications">
          <SettingsNotifications />
        </TabsContent>

        <TabsContent value="security">
          <SettingsSecurity />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsPage;
