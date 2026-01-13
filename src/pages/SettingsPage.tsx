import { Settings, Save, Link2, ExternalLink } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSettingInput } from '@/hooks/useSettings';
import { useAppMode } from '@/contexts/AppModeContext';
import { ApiHealthCheck } from '@/components/runner/ApiHealthCheck';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const SettingsPage = () => {
  const { 
    value: runnerBaseUrl, 
    onChange: setRunnerBaseUrl, 
    onSave: saveRunnerBaseUrl,
    isLoading, 
    isUpdating,
    isDirty 
  } = useSettingInput('runner_base_url');
  
  const { isExpert } = useAppMode();

  const handleSave = async () => {
    try {
      await saveRunnerBaseUrl();
      toast.success('Configuration sauvegardée');
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde');
    }
  };

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

      <Tabs defaultValue="integrations" className="space-y-6">
        <TabsList className="glass-panel">
          <TabsTrigger value="integrations" className="gap-2">
            <Link2 className="w-4 h-4" />
            Intégrations
          </TabsTrigger>
          {isExpert && (
            <TabsTrigger value="advanced" className="gap-2">
              <Settings className="w-4 h-4" />
              Avancé
            </TabsTrigger>
          )}
        </TabsList>

        {/* Integrations Tab */}
        <TabsContent value="integrations" className="space-y-6">
          {/* Runner API Configuration */}
          <div className="glass-panel rounded-xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">API des Agents (Runner)</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Configuration de la connexion entre les agents et le Control Plane
                </p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="runner_base_url">URL de base de l'API</Label>
                <div className="flex gap-2">
                  <Input
                    id="runner_base_url"
                    placeholder="https://example.supabase.co/functions/v1/runner-api"
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
                  URL publique où les agents peuvent contacter l'API du Control Plane
                </p>
              </div>

              {/* API Health */}
              <div className="pt-4 border-t border-border/50">
                <h4 className="text-sm font-medium mb-3">État de la connexion</h4>
                <ApiHealthCheck baseUrl={runnerBaseUrl} />
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Advanced Tab */}
        {isExpert && (
          <TabsContent value="advanced" className="space-y-6">
            <div className="glass-panel rounded-xl p-6">
              <h3 className="font-semibold border-b border-border pb-2 mb-4">Options Avancées</h3>
              
              <div className="p-4 rounded-lg bg-muted/30 text-sm text-muted-foreground">
                <p>Fonctionnalités avancées en cours de développement.</p>
              </div>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default SettingsPage;
