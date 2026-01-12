import { useState } from 'react';
import { Activity, Copy, Play, CheckCircle2, Server, Wifi, Clock, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCreateOrder } from '@/hooks/useOrders';
import { toast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Runner {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'paused' | 'unknown';
  last_seen_at: string | null;
  infrastructure_id: string | null;
}

interface RunnerDiagnosticsProps {
  runner: Runner;
  apiUrl?: string;
}

const DIAGNOSTIC_SCRIPT = `#!/bin/bash
# ============================================
# IKOMA Runner Diagnostic Script
# ============================================

echo "╔════════════════════════════════════════╗"
echo "║     IKOMA RUNNER DIAGNOSTICS           ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo "📅 Date: $(date)"
echo "🖥️  Hostname: $(hostname)"
echo ""

# ─────────────────────────────────────────────
# 1. SERVICE SYSTEMD
# ─────────────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1️⃣  SERVICE SYSTEMD"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if systemctl is-active --quiet runner 2>/dev/null; then
  echo "✅ Service runner: ACTIF"
  systemctl status runner --no-pager -l 2>/dev/null | head -20
else
  echo "❌ Service runner: INACTIF ou inexistant"
  echo ""
  echo "Tentative avec d'autres noms de service..."
  for svc in ikoma-runner runner-agent; do
    if systemctl is-active --quiet $svc 2>/dev/null; then
      echo "✅ Service $svc trouvé et actif"
      systemctl status $svc --no-pager -l 2>/dev/null | head -20
      break
    fi
  done
fi
echo ""

# ─────────────────────────────────────────────
# 2. PROCESSUS RUNNER
# ─────────────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2️⃣  PROCESSUS RUNNER"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

RUNNER_PID=$(pgrep -f "runner.sh" 2>/dev/null)
if [ -n "$RUNNER_PID" ]; then
  echo "✅ Processus runner trouvé: PID $RUNNER_PID"
  ps aux | grep -E "runner" | grep -v grep
else
  echo "❌ Aucun processus runner en cours"
fi
echo ""

# ─────────────────────────────────────────────
# 3. FICHIERS RUNNER
# ─────────────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3️⃣  FICHIERS RUNNER"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

RUNNER_PATHS="/opt/ikoma /opt/runner /home/runner /root/runner"
for path in $RUNNER_PATHS; do
  if [ -d "$path" ]; then
    echo "📁 Trouvé: $path"
    ls -la "$path" 2>/dev/null | head -10
    echo ""
  fi
done

if [ -f "/opt/ikoma/runner.sh" ]; then
  echo "✅ Script runner présent: /opt/ikoma/runner.sh"
  echo "   Taille: $(stat -c%s /opt/ikoma/runner.sh 2>/dev/null || echo 'N/A') bytes"
  echo "   Modifié: $(stat -c%y /opt/ikoma/runner.sh 2>/dev/null || echo 'N/A')"
else
  echo "❌ Script /opt/ikoma/runner.sh non trouvé"
fi
echo ""

# ─────────────────────────────────────────────
# 4. LOGS RÉCENTS
# ─────────────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4️⃣  LOGS RÉCENTS (30 dernières lignes)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if journalctl -u runner --no-pager -n 30 2>/dev/null; then
  echo ""
else
  echo "⚠️  Impossible de lire les logs systemd"
  # Fallback to log file
  if [ -f "/var/log/runner.log" ]; then
    echo "📄 Logs depuis /var/log/runner.log:"
    tail -30 /var/log/runner.log
  elif [ -f "/opt/ikoma/runner.log" ]; then
    echo "📄 Logs depuis /opt/ikoma/runner.log:"
    tail -30 /opt/ikoma/runner.log
  fi
fi
echo ""

# ─────────────────────────────────────────────
# 5. CONNECTIVITÉ RÉSEAU
# ─────────────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5️⃣  CONNECTIVITÉ RÉSEAU"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Test DNS
echo "🌐 Test DNS..."
if nslookup lqocccsxzqnbcwshseom.supabase.co > /dev/null 2>&1; then
  echo "✅ DNS résolution OK"
else
  echo "❌ DNS résolution ÉCHEC"
fi

# Test HTTPS vers l'API
echo ""
echo "🔗 Test connexion API..."
API_URL="https://lqocccsxzqnbcwshseom.supabase.co/functions/v1/runner-api/health"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 "$API_URL" 2>/dev/null)
if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ API accessible (HTTP $HTTP_CODE)"
else
  echo "❌ API inaccessible (HTTP $HTTP_CODE)"
fi

# Test latence
echo ""
echo "⏱️  Latence réseau..."
if command -v ping &> /dev/null; then
  ping -c 3 lqocccsxzqnbcwshseom.supabase.co 2>/dev/null | tail -3
fi
echo ""

# ─────────────────────────────────────────────
# 6. RESSOURCES SYSTÈME
# ─────────────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "6️⃣  RESSOURCES SYSTÈME"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "💾 Mémoire:"
free -h 2>/dev/null || cat /proc/meminfo | head -5

echo ""
echo "💿 Disque:"
df -h / 2>/dev/null

echo ""
echo "⚡ Load Average:"
uptime
echo ""

# ─────────────────────────────────────────────
# 7. CONFIGURATION RUNNER
# ─────────────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "7️⃣  CONFIGURATION (sans secrets)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -f "/opt/ikoma/runner.sh" ]; then
  echo "Variables API_URL configurées:"
  grep -E "^API_URL=" /opt/ikoma/runner.sh 2>/dev/null | head -1 || echo "Non trouvé"
  echo ""
  echo "Token configuré: $(grep -q 'RUNNER_TOKEN=' /opt/ikoma/runner.sh && echo '✅ Oui' || echo '❌ Non')"
fi
echo ""

# ─────────────────────────────────────────────
# RÉSUMÉ
# ─────────────────────────────────────────────
echo "╔════════════════════════════════════════╗"
echo "║           FIN DU DIAGNOSTIC            ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo "📋 Actions recommandées si le runner est offline:"
echo "   1. sudo systemctl restart runner"
echo "   2. sudo journalctl -u runner -f  (pour suivre les logs)"
echo "   3. Vérifier la connectivité réseau"
echo ""
`;

export function RunnerDiagnostics({ runner, apiUrl }: RunnerDiagnosticsProps) {
  const [copied, setCopied] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const createOrder = useCreateOrder();

  const lastSeenText = runner.last_seen_at
    ? formatDistanceToNow(new Date(runner.last_seen_at), { addSuffix: true, locale: fr })
    : 'Jamais';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(DIAGNOSTIC_SCRIPT);
    setCopied(true);
    toast({
      title: 'Script copié',
      description: 'Collez-le sur le serveur et exécutez-le avec: bash diagnostic.sh',
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRunDiagnostic = async () => {
    if (!runner.infrastructure_id) {
      toast({
        title: 'Erreur',
        description: 'Le runner doit être associé à une infrastructure',
        variant: 'destructive',
      });
      return;
    }

    try {
      await createOrder.mutateAsync({
        runner_id: runner.id,
        infrastructure_id: runner.infrastructure_id,
        category: 'maintenance',
        name: `Diagnostic: ${runner.name}`,
        description: '[system.diagnostic] Diagnostic complet du runner',
        command: DIAGNOSTIC_SCRIPT,
      });

      toast({
        title: 'Ordre créé',
        description: 'Le diagnostic sera exécuté lorsque le runner sera en ligne',
      });
      setIsOpen(false);
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de créer l\'ordre de diagnostic',
        variant: 'destructive',
      });
    }
  };

  const getStatusColor = (status: Runner['status']) => {
    switch (status) {
      case 'online': return 'bg-green-500/10 text-green-500 border-green-500/30';
      case 'offline': return 'bg-red-500/10 text-red-500 border-red-500/30';
      case 'paused': return 'bg-amber-500/10 text-amber-500 border-amber-500/30';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Activity className="w-4 h-4 mr-2" />
          Diagnostic
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Diagnostic Runner
          </DialogTitle>
          <DialogDescription>
            Script de diagnostic complet pour analyser l'état du runner
          </DialogDescription>
        </DialogHeader>

        {/* Runner Status Card */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Server className="w-4 h-4" />
              {runner.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Wifi className="w-4 h-4 text-muted-foreground" />
                <Badge className={getStatusColor(runner.status)}>
                  {runner.status === 'online' ? 'En ligne' : 
                   runner.status === 'offline' ? 'Hors ligne' :
                   runner.status === 'paused' ? 'En pause' : 'Inconnu'}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>Vu {lastSeenText}</span>
              </div>
            </div>

            {runner.status === 'offline' && (
              <Alert variant="destructive" className="py-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  Le runner n'envoie plus de heartbeat depuis plus de 60 secondes.
                  Vérifiez le service systemd sur le serveur.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Script Preview */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Script de diagnostic</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {copied ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2 text-green-500" />
                    Copié
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copier
                  </>
                )}
              </Button>
              {runner.infrastructure_id && (
                <Button 
                  size="sm" 
                  onClick={handleRunDiagnostic}
                  disabled={createOrder.isPending}
                >
                  <Play className="w-4 h-4 mr-2" />
                  {runner.status === 'offline' ? 'Planifier' : 'Exécuter'}
                </Button>
              )}
            </div>
          </div>
          
          <ScrollArea className="h-[300px] rounded-lg border bg-muted/30">
            <pre className="p-4 text-xs font-mono whitespace-pre-wrap">
              {DIAGNOSTIC_SCRIPT}
            </pre>
          </ScrollArea>
        </div>

        {/* Instructions */}
        <div className="text-sm text-muted-foreground space-y-1">
          <p><strong>Exécution manuelle :</strong></p>
          <code className="block bg-muted px-2 py-1 rounded text-xs">
            curl -sSL "https://..." | bash
          </code>
          <p className="text-xs mt-2">
            Ou copiez le script et exécutez-le directement sur le serveur.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}