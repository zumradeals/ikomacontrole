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
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <PageHeader
        title="Runners"
        description="Gérer les agents déployés sur vos serveurs"
        icon={Server}
        actions={
          <Button variant="outline" size="sm" onClick={() => refetchRunners()}>
            <RefreshCw className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Actualiser</span>
          </Button>
        }
      />

      {/* Configuration API */}
      <div className="glass-panel rounded-xl p-4 sm:p-5 glow-border">
        <div className="flex items-center gap-2 mb-3 sm:mb-4">
          <Settings2 className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          <h3 className="font-semibold text-sm sm:text-base">Configuration API</h3>
        </div>
        
        <div className="space-y-3 sm:space-y-4">
          <div className="space-y-2">
            <Label htmlFor="runner_base_url" className="text-xs sm:text-sm">URL de base du Runner API</Label>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                id="runner_base_url"
                placeholder="https://...supabase.co/functions/v1/runner-api"
                value={runnerBaseUrl}
                onChange={(e) => setRunnerBaseUrl(e.target.value)}
                className="text-sm"
              />
              <Button 
                onClick={handleSave} 
                disabled={!isDirty || isUpdating}
                variant={isDirty ? "default" : "outline"}
                className="shrink-0"
              >
                <Save className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">{isUpdating ? 'Sauvegarde...' : 'Sauvegarder'}</span>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              URL où les runners peuvent contacter l'API.
            </p>
          </div>

          {/* Health Check */}
          <ApiHealthCheck baseUrl={runnerBaseUrl} />
        </div>
      </div>

      {/* Installation Script - Expert mode */}
      {isExpert && (
        <div className="glass-panel rounded-xl p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <Terminal className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            <h3 className="font-semibold text-sm sm:text-base">Script d'Installation</h3>
          </div>
          
          <InstallScript baseUrl={runnerBaseUrl} />
        </div>
      )}

      {/* Runners Table */}
      <div className="glass-panel rounded-xl p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h3 className="font-semibold text-sm sm:text-base">Runners Enregistrés</h3>
        </div>
        
        {/* Horizontal scroll on mobile for table */}
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <RunnersTable />
        </div>
      </div>
    </div>
  );
};

export default Runner;
