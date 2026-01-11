import { useState } from 'react';
import { 
  Download, 
  RefreshCw, 
  Shield, 
  Wrench, 
  Clock, 
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Container,
  GitBranch,
  Globe,
  Zap,
  Database,
  Server
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCreateOrder, OrderCategory } from '@/hooks/useOrders';

interface Runner {
  id: string;
  name: string;
  status: string;
}

interface SystemOrdersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  runner: Runner;
  infrastructureId?: string;
}

interface OrderTemplate {
  id: string;
  name: string;
  description: string;
  command: string;
  category: OrderCategory;
  risk: 'low' | 'medium' | 'high';
  duration: string;
  icon: React.ReactNode;
  prerequisites?: string[];
}

const INSTALLATION_ORDERS: OrderTemplate[] = [
  {
    id: 'install_docker',
    name: 'Installer Docker',
    description: 'Installer Docker Engine et Docker Compose sur Ubuntu/Debian',
    command: 'curl -fsSL https://get.docker.com | sh && sudo usermod -aG docker $USER',
    category: 'installation',
    risk: 'medium',
    duration: '~5 minutes',
    icon: <Container className="w-5 h-5" />,
  },
  {
    id: 'install_supabase',
    name: 'Installer Supabase Self-Hosted',
    description: 'Installer Supabase CLI et préparer le self-hosting',
    command: 'npm install -g supabase && supabase init',
    category: 'installation',
    risk: 'medium',
    duration: '~10 minutes',
    icon: <Database className="w-5 h-5" />,
    prerequisites: ['docker_compose'],
  },
  {
    id: 'install_nodejs',
    name: 'Installer Node.js',
    description: 'Installer Node.js LTS via NodeSource',
    command: 'curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt-get install -y nodejs',
    category: 'installation',
    risk: 'low',
    duration: '~2 minutes',
    icon: <Zap className="w-5 h-5" />,
  },
  {
    id: 'install_nginx',
    name: 'Installer Nginx',
    description: 'Installer Nginx comme reverse proxy',
    command: 'sudo apt-get update && sudo apt-get install -y nginx && sudo systemctl enable nginx',
    category: 'installation',
    risk: 'low',
    duration: '~1 minute',
    icon: <Globe className="w-5 h-5" />,
  },
  {
    id: 'install_git',
    name: 'Installer Git',
    description: 'Installer Git pour le contrôle de version',
    command: 'sudo apt-get update && sudo apt-get install -y git',
    category: 'installation',
    risk: 'low',
    duration: '~1 minute',
    icon: <GitBranch className="w-5 h-5" />,
  },
];

const UPDATE_ORDERS: OrderTemplate[] = [
  {
    id: 'update_system',
    name: 'Mettre à jour le système',
    description: 'Mettre à jour tous les paquets du système',
    command: 'sudo apt-get update && sudo apt-get upgrade -y',
    category: 'update',
    risk: 'medium',
    duration: '~5-15 minutes',
    icon: <RefreshCw className="w-5 h-5" />,
  },
  {
    id: 'update_docker',
    name: 'Mettre à jour Docker',
    description: 'Mettre à jour Docker vers la dernière version',
    command: 'sudo apt-get update && sudo apt-get install -y docker-ce docker-ce-cli containerd.io',
    category: 'update',
    risk: 'medium',
    duration: '~3 minutes',
    icon: <Container className="w-5 h-5" />,
  },
  {
    id: 'update_runner',
    name: 'Mettre à jour le runner',
    description: 'Réinstaller le runner Ikoma avec les dernières mises à jour',
    command: 'systemctl restart ikoma-runner',
    category: 'update',
    risk: 'low',
    duration: '~1 minute',
    icon: <Server className="w-5 h-5" />,
  },
];

const SECURITY_ORDERS: OrderTemplate[] = [
  {
    id: 'enable_firewall',
    name: 'Activer le pare-feu UFW',
    description: 'Activer UFW et autoriser SSH',
    command: 'sudo ufw default deny incoming && sudo ufw default allow outgoing && sudo ufw allow ssh && sudo ufw --force enable',
    category: 'security',
    risk: 'high',
    duration: '~1 minute',
    icon: <Shield className="w-5 h-5" />,
  },
  {
    id: 'install_fail2ban',
    name: 'Installer Fail2ban',
    description: 'Protection contre les attaques par force brute',
    command: 'sudo apt-get update && sudo apt-get install -y fail2ban && sudo systemctl enable fail2ban && sudo systemctl start fail2ban',
    category: 'security',
    risk: 'low',
    duration: '~2 minutes',
    icon: <Shield className="w-5 h-5" />,
  },
  {
    id: 'update_security',
    name: 'Mises à jour de sécurité',
    description: 'Installer uniquement les mises à jour de sécurité',
    command: 'sudo apt-get update && sudo apt-get install -y unattended-upgrades && sudo unattended-upgrade',
    category: 'security',
    risk: 'medium',
    duration: '~5 minutes',
    icon: <Shield className="w-5 h-5" />,
  },
];

const MAINTENANCE_ORDERS: OrderTemplate[] = [
  {
    id: 'cleanup_docker',
    name: 'Nettoyer Docker',
    description: 'Supprimer les images, conteneurs et volumes inutilisés',
    command: 'docker system prune -af --volumes',
    category: 'maintenance',
    risk: 'medium',
    duration: '~2 minutes',
    icon: <Wrench className="w-5 h-5" />,
  },
  {
    id: 'cleanup_apt',
    name: 'Nettoyer le cache APT',
    description: 'Libérer de l\'espace disque en nettoyant le cache',
    command: 'sudo apt-get clean && sudo apt-get autoremove -y',
    category: 'maintenance',
    risk: 'low',
    duration: '~1 minute',
    icon: <Wrench className="w-5 h-5" />,
  },
  {
    id: 'check_disk',
    name: 'Vérifier l\'espace disque',
    description: 'Afficher l\'utilisation du disque',
    command: 'df -h && du -sh /var/log/* 2>/dev/null | sort -h | tail -10',
    category: 'maintenance',
    risk: 'low',
    duration: '~10 secondes',
    icon: <Wrench className="w-5 h-5" />,
  },
  {
    id: 'rotate_logs',
    name: 'Rotation des logs',
    description: 'Forcer la rotation des fichiers de logs',
    command: 'sudo logrotate -f /etc/logrotate.conf',
    category: 'maintenance',
    risk: 'low',
    duration: '~30 secondes',
    icon: <Wrench className="w-5 h-5" />,
  },
];

const riskColors = {
  low: 'bg-green-500/10 text-green-400 border-green-500/30',
  medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  high: 'bg-red-500/10 text-red-400 border-red-500/30',
};

const riskLabels = {
  low: 'Risque faible',
  medium: 'Risque modéré',
  high: 'Risque élevé',
};

interface OrderCardProps {
  template: OrderTemplate;
  onExecute: (template: OrderTemplate) => void;
  isLoading: boolean;
}

function OrderCard({ template, onExecute, isLoading }: OrderCardProps) {
  return (
    <div className="flex items-start justify-between p-4 rounded-lg bg-muted/30 border border-border/50 hover:border-primary/30 transition-colors">
      <div className="flex items-start gap-3 flex-1">
        <div className="text-primary mt-0.5">{template.icon}</div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-medium">{template.name}</h4>
            <Badge variant="outline" className={riskColors[template.risk]}>
              {riskLabels[template.risk]}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{template.description}</p>
          {template.prerequisites && template.prerequisites.length > 0 && (
            <p className="text-xs text-amber-400 mt-2 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Prérequis manquants : {template.prerequisites.join(', ')}
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end gap-2">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          {template.duration}
        </div>
        <Button 
          size="sm" 
          variant="outline"
          onClick={() => onExecute(template)}
          disabled={isLoading}
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Exécuter'}
        </Button>
      </div>
    </div>
  );
}

export function SystemOrdersDialog({ 
  open, 
  onOpenChange, 
  runner,
  infrastructureId 
}: SystemOrdersDialogProps) {
  const [executingId, setExecutingId] = useState<string | null>(null);
  const createOrder = useCreateOrder();

  const handleExecute = async (template: OrderTemplate) => {
    setExecutingId(template.id);
    try {
      await createOrder.mutateAsync({
        runner_id: runner.id,
        infrastructure_id: infrastructureId,
        category: template.category,
        name: template.name,
        description: template.description,
        command: template.command,
      });
    } finally {
      setExecutingId(null);
    }
  };

  const isRunnerOnline = runner.status === 'online';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 text-primary" />
            <div>
              <DialogTitle>Ordres système pour {runner.name}</DialogTitle>
              <DialogDescription>
                Envoyez des ordres d'installation, mise à jour ou maintenance au runner. Chaque action est un ordre explicite.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {!isRunnerOnline && (
          <div className="mx-6 mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Le runner est actuellement hors ligne. Les ordres seront exécutés à sa prochaine connexion.
          </div>
        )}

        <Tabs defaultValue="installation" className="flex-1">
          <TabsList className="mx-6 grid grid-cols-4 w-auto">
            <TabsTrigger value="installation" className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              Installation
            </TabsTrigger>
            <TabsTrigger value="update" className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Mise à jour
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Sécurité
            </TabsTrigger>
            <TabsTrigger value="maintenance" className="flex items-center gap-2">
              <Wrench className="w-4 h-4" />
              Maintenance
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[calc(85vh-200px)] px-6 pb-6 mt-4">
            <TabsContent value="installation" className="space-y-3 mt-0">
              {INSTALLATION_ORDERS.map((template) => (
                <OrderCard 
                  key={template.id} 
                  template={template} 
                  onExecute={handleExecute}
                  isLoading={executingId === template.id}
                />
              ))}
            </TabsContent>

            <TabsContent value="update" className="space-y-3 mt-0">
              {UPDATE_ORDERS.map((template) => (
                <OrderCard 
                  key={template.id} 
                  template={template} 
                  onExecute={handleExecute}
                  isLoading={executingId === template.id}
                />
              ))}
            </TabsContent>

            <TabsContent value="security" className="space-y-3 mt-0">
              {SECURITY_ORDERS.map((template) => (
                <OrderCard 
                  key={template.id} 
                  template={template} 
                  onExecute={handleExecute}
                  isLoading={executingId === template.id}
                />
              ))}
            </TabsContent>

            <TabsContent value="maintenance" className="space-y-3 mt-0">
              {MAINTENANCE_ORDERS.map((template) => (
                <OrderCard 
                  key={template.id} 
                  template={template} 
                  onExecute={handleExecute}
                  isLoading={executingId === template.id}
                />
              ))}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}