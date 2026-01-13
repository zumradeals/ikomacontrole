import { Bell, Mail, MessageSquare, Webhook, AlertTriangle, Server, XCircle, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface NotificationChannel {
  id: string;
  name: string;
  icon: typeof Mail;
  enabled: boolean;
  configured: boolean;
  description: string;
}

const channels: NotificationChannel[] = [
  {
    id: 'email',
    name: 'Email',
    icon: Mail,
    enabled: false,
    configured: false,
    description: 'Notifications par email aux administrateurs',
  },
  {
    id: 'slack',
    name: 'Slack',
    icon: MessageSquare,
    enabled: false,
    configured: false,
    description: 'Messages dans un canal Slack dédié',
  },
  {
    id: 'webhook',
    name: 'Webhook personnalisé',
    icon: Webhook,
    enabled: false,
    configured: false,
    description: 'Appels HTTP vers votre endpoint',
  },
];

interface NotificationThreshold {
  id: string;
  name: string;
  icon: typeof AlertTriangle;
  description: string;
  enabled: boolean;
}

const thresholds: NotificationThreshold[] = [
  {
    id: 'runner_offline',
    name: 'Agent hors ligne',
    icon: Server,
    description: 'Quand un agent ne répond plus depuis 2 minutes',
    enabled: true,
  },
  {
    id: 'order_failed',
    name: 'Ordre échoué',
    icon: XCircle,
    description: 'Quand un ordre se termine avec une erreur',
    enabled: true,
  },
  {
    id: 'service_down',
    name: 'Service indisponible',
    icon: Layers,
    description: 'Quand un service plateforme devient inaccessible',
    enabled: false,
  },
];

export function SettingsNotifications() {
  return (
    <div className="space-y-6">
      {/* Notification Channels */}
      <div className="glass-panel rounded-xl p-6 space-y-6">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
            Canaux de Notification
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Configurez comment recevoir les alertes
          </p>
        </div>

        <div className="space-y-3">
          {channels.map((channel) => {
            const Icon = channel.icon;
            return (
              <div 
                key={channel.id}
                className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-muted/20"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">{channel.name}</p>
                    <p className="text-xs text-muted-foreground">{channel.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {!channel.configured && (
                    <Button variant="outline" size="sm" disabled>
                      Configurer
                    </Button>
                  )}
                  <Switch disabled checked={channel.enabled} />
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-xs text-muted-foreground p-3 bg-primary/5 rounded-lg border border-primary/10">
          Les notifications seront disponibles dans une prochaine version.
        </div>
      </div>

      {/* Alert Thresholds */}
      <div className="glass-panel rounded-xl p-6 space-y-6">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-primary" />
            Seuils d'Alerte
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Définissez quand déclencher les notifications
          </p>
        </div>

        <div className="space-y-3">
          {thresholds.map((threshold) => {
            const Icon = threshold.icon;
            return (
              <div 
                key={threshold.id}
                className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-muted/20"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    threshold.id === 'runner_offline' ? 'bg-amber-500/10 text-amber-400' :
                    threshold.id === 'order_failed' ? 'bg-red-500/10 text-red-400' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-medium">{threshold.name}</p>
                    <p className="text-xs text-muted-foreground">{threshold.description}</p>
                  </div>
                </div>
                <Switch disabled checked={threshold.enabled} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Custom Alert Settings - Placeholder */}
      <div className="glass-panel rounded-xl p-6 space-y-6">
        <div>
          <h3 className="font-semibold">Paramètres personnalisés</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Ajustez les délais et la fréquence
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="offline_delay">Délai agent hors ligne (secondes)</Label>
            <Input
              id="offline_delay"
              type="number"
              defaultValue={120}
              disabled
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cooldown">Cooldown entre alertes (minutes)</Label>
            <Input
              id="cooldown"
              type="number"
              defaultValue={15}
              disabled
            />
          </div>
        </div>
      </div>
    </div>
  );
}
