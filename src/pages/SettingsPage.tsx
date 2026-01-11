import { Settings, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSettings } from '@/hooks/useSettings';
import { useAppMode } from '@/contexts/AppModeContext';
import { ApiHealthCheck } from '@/components/runner/ApiHealthCheck';
import { Skeleton } from '@/components/ui/skeleton';

const SettingsPage = () => {
  const { getSetting, updateSetting, isLoading, isUpdating } = useSettings();
  const { isExpert } = useAppMode();

  const runnerBaseUrl = getSetting('runner_base_url');

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Paramètres"
        description="Configuration du Control Plane"
        icon={Settings}
      />

      {/* Settings Form */}
      <div className="glass-panel rounded-xl p-6 space-y-6">
        <div className="space-y-4">
          <h3 className="font-semibold border-b border-border pb-2">Configuration Runner API</h3>
          
          <div className="space-y-2">
            <Label htmlFor="runner_base_url">URL de base du Runner API</Label>
            <Input
              id="runner_base_url"
              placeholder="https://lqocccsxzqnbcwshseom.supabase.co/functions/v1/runner-api"
              value={runnerBaseUrl}
              onChange={(e) => updateSetting('runner_base_url', e.target.value)}
              disabled={isUpdating}
            />
            <p className="text-xs text-muted-foreground">
              URL publique où les runners peuvent contacter l'API du Control Plane
            </p>
          </div>
        </div>

        {isExpert && (
          <div className="space-y-4">
            <h3 className="font-semibold border-b border-border pb-2">Options Avancées</h3>
            
            <div className="p-4 rounded-lg bg-muted/30 text-sm text-muted-foreground">
              <p>Fonctionnalités avancées en cours de développement.</p>
            </div>
          </div>
        )}
      </div>

      {/* API Health */}
      <div className="glass-panel rounded-xl p-5">
        <h3 className="font-semibold mb-4">État de l'API</h3>
        <ApiHealthCheck baseUrl={runnerBaseUrl} />
      </div>
    </div>
  );
};

export default SettingsPage;
