import { Settings, Save, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSettings } from '@/contexts/SettingsContext';
import { useAppMode } from '@/contexts/AppModeContext';
import { useState } from 'react';

const SettingsPage = () => {
  const { settings, updateSetting } = useSettings();
  const { isExpert } = useAppMode();
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Paramètres"
        description="Configuration du Control Plane"
        icon={Settings}
        actions={
          <Button onClick={handleSave} disabled={saved}>
            {saved ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Enregistré
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Enregistrer
              </>
            )}
          </Button>
        }
      />

      {/* Settings Form */}
      <div className="glass-panel rounded-xl p-6 space-y-6">
        <div className="space-y-4">
          <h3 className="font-semibold border-b border-border pb-2">Configuration Runner API</h3>
          
          <div className="space-y-2">
            <Label htmlFor="runner_base_url">URL de base du Runner API</Label>
            <Input
              id="runner_base_url"
              placeholder="https://runner.example.com"
              value={settings.runner_base_url}
              onChange={(e) => updateSetting('runner_base_url', e.target.value)}
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
              <p>Les options avancées seront disponibles après connexion à Supabase Cloud.</p>
            </div>
          </div>
        )}
      </div>

      {/* API Health */}
      <div className="glass-panel rounded-xl p-5">
        <h3 className="font-semibold mb-4">État de l'API</h3>
        
        <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/30">
          <span className="status-dot status-offline" />
          <div>
            <p className="text-sm font-medium">Non connecté</p>
            <p className="text-xs text-muted-foreground">
              Configurez l'URL et connectez-vous à Supabase Cloud
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
