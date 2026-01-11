import { Server, Plus, RefreshCw, Terminal, Copy, Check } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSettings } from '@/contexts/SettingsContext';
import { useAppMode } from '@/contexts/AppModeContext';
import { useState } from 'react';

const Runner = () => {
  const { settings, updateSetting } = useSettings();
  const { isExpert } = useAppMode();
  const [copied, setCopied] = useState(false);

  const installScript = settings.runner_base_url 
    ? `curl -sSL ${settings.runner_base_url}/install-runner.sh | bash -s -- --token YOUR_TOKEN --api-url ${settings.runner_base_url}`
    : 'Configurez l\'URL de base pour générer le script d\'installation';

  const handleCopy = () => {
    if (settings.runner_base_url) {
      navigator.clipboard.writeText(installScript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Runners"
        description="Gérer les agents déployés sur vos serveurs"
        icon={Server}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualiser
            </Button>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Nouveau Runner
            </Button>
          </div>
        }
      />

      {/* Configuration */}
      <div className="glass-panel rounded-xl p-5 glow-border">
        <h3 className="font-semibold mb-4">Configuration API</h3>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="runner_base_url">URL de base du Runner API</Label>
            <Input
              id="runner_base_url"
              placeholder="https://runner.example.com"
              value={settings.runner_base_url}
              onChange={(e) => updateSetting('runner_base_url', e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              URL publique où les runners peuvent contacter l'API
            </p>
          </div>

          {/* Health Check Status */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30">
            <span className="status-dot status-offline" />
            <span className="text-sm text-muted-foreground">
              {settings.runner_base_url ? 'Non connecté' : 'URL non configurée'}
            </span>
          </div>
        </div>
      </div>

      {/* Installation Script */}
      {isExpert && (
        <div className="glass-panel rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Terminal className="w-4 h-4 text-primary" />
              Script d'Installation
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              disabled={!settings.runner_base_url}
            >
              {copied ? (
                <Check className="w-4 h-4 text-success" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
          </div>
          
          <pre className="p-4 rounded-lg bg-muted/50 overflow-x-auto terminal-scroll">
            <code className="text-sm font-mono text-muted-foreground">
              {installScript}
            </code>
          </pre>
        </div>
      )}

      {/* Runners Table */}
      <div className="glass-panel rounded-xl p-5">
        <h3 className="font-semibold mb-4">Runners Enregistrés</h3>
        
        <div className="text-center py-12 text-muted-foreground">
          <Server className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Aucun runner enregistré</p>
          <p className="text-sm mt-2">
            Installez un runner sur votre serveur pour commencer
          </p>
        </div>
      </div>
    </div>
  );
};

export default Runner;
