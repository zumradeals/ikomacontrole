import { Server, RefreshCw, Terminal, Settings2, Save } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSettingInput } from '@/hooks/useSettings';
import { useAppMode } from '@/contexts/AppModeContext';
import { ApiHealthCheck } from '@/components/runner/ApiHealthCheck';
import { RunnersTable } from '@/components/runner/RunnersTable';
import { InstallScript } from '@/components/runner/InstallScript';
import { useRunners } from '@/hooks/useRunners';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

const Runner = () => {
  const { 
    value: runnerBaseUrl, 
    onChange: setRunnerBaseUrl, 
    onSave: saveRunnerBaseUrl,
    isLoading: settingsLoading, 
    isUpdating,
    isDirty 
  } = useSettingInput('runner_base_url');
  
  const { isExpert } = useAppMode();
  const { refetch: refetchRunners } = useRunners();

  const handleSave = async () => {
    try {
      await saveRunnerBaseUrl();
      toast.success('Configuration sauvegardée');
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde');
    }
  };

  if (settingsLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Runners"
        description="Gérer les agents déployés sur vos serveurs"
        icon={Server}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetchRunners()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualiser
            </Button>
          </div>
        }
      />

      {/* Configuration API */}
      <div className="glass-panel rounded-xl p-5 glow-border">
        <div className="flex items-center gap-2 mb-4">
          <Settings2 className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Configuration API</h3>
        </div>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="runner_base_url">URL de base du Runner API</Label>
            <div className="flex gap-2">
              <Input
                id="runner_base_url"
                placeholder="https://lqocccsxzqnbcwshseom.supabase.co/functions/v1/runner-api"
                value={runnerBaseUrl}
                onChange={(e) => setRunnerBaseUrl(e.target.value)}
              />
              <Button 
                onClick={handleSave} 
                disabled={!isDirty || isUpdating}
                variant={isDirty ? "default" : "outline"}
              >
                <Save className="w-4 h-4 mr-2" />
                {isUpdating ? 'Sauvegarde...' : 'Sauvegarder'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              URL où les runners peuvent contacter l'API. Utilisez l'URL de votre Edge Function.
            </p>
          </div>

          {/* Health Check */}
          <ApiHealthCheck baseUrl={runnerBaseUrl} />
        </div>
      </div>

      {/* Installation Script - Expert mode */}
      {isExpert && (
        <div className="glass-panel rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Terminal className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Script d'Installation</h3>
          </div>
          
          <InstallScript baseUrl={runnerBaseUrl} />
        </div>
      )}

      {/* Runners Table */}
      <div className="glass-panel rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Runners Enregistrés</h3>
        </div>
        
        <RunnersTable />
      </div>
    </div>
  );
};

export default Runner;
