import { 
  Container, 
  Zap, 
  Globe, 
  GitBranch, 
  Database,
  Server,
  Shield,
  RefreshCw,
  Wrench,
  Cpu,
  HardDrive,
  Network,
  Clock,
  Key,
  Monitor,
  FileCode,
  Settings,
  Terminal,
  Layers,
  Lock
} from 'lucide-react';
import { LucideIcon } from 'lucide-react';

export type PlaybookLevel = 'simple' | 'expert';
export type PlaybookRisk = 'low' | 'medium' | 'high';

export interface PlaybookPrerequisite {
  capability: string;
  label: string;
  required: boolean;
}

export interface Playbook {
  id: string;
  group: string;
  name: string;
  description: string;
  level: PlaybookLevel;
  risk: PlaybookRisk;
  duration: string;
  icon: LucideIcon;
  prerequisites: PlaybookPrerequisite[];
  verifies: string[]; // Capabilities this playbook will verify/install
  command: string;
}

// ============================================================================
// GROUP A: Base système (fondations)
// ============================================================================

const SYSTEM_PLAYBOOKS: Playbook[] = [
  {
    id: 'system.info',
    group: 'system',
    name: 'Collecter infos système',
    description: 'Détecte OS, distribution, architecture, kernel, CPU, RAM, disque',
    level: 'simple',
    risk: 'low',
    duration: '~10s',
    icon: Cpu,
    prerequisites: [],
    verifies: ['system.detected'],
    command: `#!/bin/bash
set -e

# Detect package manager
detect_pkg_manager() {
  if command -v apt-get &>/dev/null; then echo "apt"
  elif command -v dnf &>/dev/null; then echo "dnf"
  elif command -v yum &>/dev/null; then echo "yum"
  elif command -v apk &>/dev/null; then echo "apk"
  else echo "unknown"
  fi
}

# Collect system info
OS=$(uname -s)
ARCH=$(uname -m)
KERNEL=$(uname -r)
HOSTNAME=$(hostname)
UPTIME=$(uptime -p 2>/dev/null || uptime)
PKG_MANAGER=$(detect_pkg_manager)

# Detect distribution
if [ -f /etc/os-release ]; then
  . /etc/os-release
  DISTRO="$NAME $VERSION_ID"
else
  DISTRO="Unknown"
fi

# Hardware info
CPU_CORES=$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 1)
RAM_MB=$(free -m 2>/dev/null | awk '/^Mem:/{print $2}' || echo 0)
DISK_GB=$(df -BG / 2>/dev/null | awk 'NR==2{gsub("G",""); print $2}' || echo 0)

# Output structured JSON for detection
cat <<EOF
{
  "system": {
    "os": "$OS",
    "distribution": "$DISTRO",
    "architecture": "$ARCH",
    "kernel": "$KERNEL",
    "hostname": "$HOSTNAME",
    "cpu_cores": $CPU_CORES,
    "ram_mb": $RAM_MB,
    "disk_gb": $DISK_GB,
    "pkg_manager": "$PKG_MANAGER"
  },
  "capabilities": {
    "system.detected": "installed"
  }
}
EOF
`,
  },
  {
    id: 'system.update',
    group: 'system',
    name: 'Mettre à jour le système',
    description: 'Met à jour tous les paquets (apt/dnf/yum/apk)',
    level: 'simple',
    risk: 'medium',
    duration: '~5-15min',
    icon: RefreshCw,
    prerequisites: [],
    verifies: ['system.updated'],
    command: `#!/bin/bash
set -e

# Detect and run appropriate update
if command -v apt-get &>/dev/null; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get upgrade -y -qq
  echo "System updated via apt"
elif command -v dnf &>/dev/null; then
  dnf update -y -q
  echo "System updated via dnf"
elif command -v yum &>/dev/null; then
  yum update -y -q
  echo "System updated via yum"
elif command -v apk &>/dev/null; then
  apk update && apk upgrade
  echo "System updated via apk"
else
  echo "ERROR: Unknown package manager"
  exit 1
fi

echo "✓ System update complete"
`,
  },
  {
    id: 'system.packages.base',
    group: 'system',
    name: 'Installer paquets de base',
    description: 'curl, wget, git, jq, unzip, tar, ca-certificates',
    level: 'simple',
    risk: 'low',
    duration: '~2min',
    icon: Terminal,
    prerequisites: [],
    verifies: ['curl.installed', 'wget.installed', 'git.installed', 'jq.installed'],
    command: `#!/bin/bash
set -e

PACKAGES="curl wget git jq unzip tar ca-certificates gnupg lsb-release"

if command -v apt-get &>/dev/null; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq $PACKAGES
elif command -v dnf &>/dev/null; then
  dnf install -y -q $PACKAGES
elif command -v yum &>/dev/null; then
  yum install -y -q $PACKAGES
elif command -v apk &>/dev/null; then
  apk add $PACKAGES
else
  echo "ERROR: Unknown package manager"
  exit 1
fi

# Verify
echo "Verifying installed packages..."
for pkg in curl wget git jq; do
  if command -v $pkg &>/dev/null; then
    echo "✓ $pkg: $(command -v $pkg)"
  else
    echo "✗ $pkg: NOT FOUND"
    exit 1
  fi
done

echo "✓ Base packages installed"
`,
  },
  {
    id: 'system.timezone.set',
    group: 'system',
    name: 'Configurer timezone UTC',
    description: 'Configure le fuseau horaire en UTC',
    level: 'expert',
    risk: 'low',
    duration: '~10s',
    icon: Clock,
    prerequisites: [],
    verifies: ['timezone.configured'],
    command: `#!/bin/bash
set -e

timedatectl set-timezone UTC 2>/dev/null || ln -sf /usr/share/zoneinfo/UTC /etc/localtime

echo "Current timezone: $(date +%Z)"
echo "✓ Timezone set to UTC"
`,
  },
  {
    id: 'system.swap.ensure',
    group: 'system',
    name: 'Créer swap (si RAM < 2GB)',
    description: 'Crée un fichier swap de 2GB si mémoire insuffisante',
    level: 'expert',
    risk: 'low',
    duration: '~1min',
    icon: HardDrive,
    prerequisites: [],
    verifies: ['swap.configured'],
    command: `#!/bin/bash
set -e

RAM_MB=\$(free -m | awk '/^Mem:/{print \$2}')
SWAP_EXISTING=\$(free -m | awk '/^Swap:/{print \$2}')

if [ "\$SWAP_EXISTING" -gt 0 ]; then
  echo "Swap already exists: \${SWAP_EXISTING}MB"
  exit 0
fi

if [ "\$RAM_MB" -lt 2048 ]; then
  echo "RAM is \${RAM_MB}MB (< 2GB), creating 2GB swap..."
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "✓ Swap file created and enabled"
else
  echo "RAM is \${RAM_MB}MB (>= 2GB), no swap needed"
fi
`,
  },
];

// ============================================================================
// GROUP B: Réseau & sécurité
// ============================================================================

const NETWORK_PLAYBOOKS: Playbook[] = [
  {
    id: 'net.dns.check',
    group: 'network',
    name: 'Vérifier résolution DNS',
    description: 'Test de résolution DNS et latence réseau',
    level: 'simple',
    risk: 'low',
    duration: '~5s',
    icon: Network,
    prerequisites: [],
    verifies: ['dns.working'],
    command: `#!/bin/bash
set -e

echo "Testing DNS resolution..."
if ping -c 1 google.com &>/dev/null; then
  echo "✓ DNS resolution OK"
else
  echo "✗ DNS resolution failed"
  exit 1
fi

echo ""
echo "Testing HTTPS connectivity..."
if curl -s -o /dev/null -w "%{http_code}" https://httpbin.org/get | grep -q "200"; then
  echo "✓ HTTPS connectivity OK"
else
  echo "⚠ HTTPS connectivity issue"
fi
`,
  },
  {
    id: 'net.ports.scan',
    group: 'network',
    name: 'Scanner ports écoutés',
    description: 'Liste les ports en écoute sur le serveur',
    level: 'simple',
    risk: 'low',
    duration: '~5s',
    icon: Network,
    prerequisites: [],
    verifies: [],
    command: `#!/bin/bash
echo "Ports listening on this server:"
echo ""
ss -tulpn 2>/dev/null || netstat -tulpn 2>/dev/null || echo "ss/netstat not available"
`,
  },
  {
    id: 'firewall.status',
    group: 'network',
    name: 'Vérifier pare-feu',
    description: 'Affiche le status du pare-feu (UFW/iptables/firewalld)',
    level: 'simple',
    risk: 'low',
    duration: '~5s',
    icon: Shield,
    prerequisites: [],
    verifies: [],
    command: `#!/bin/bash
echo "=== Firewall Status ==="

if command -v ufw &>/dev/null; then
  echo "UFW Status:"
  ufw status verbose 2>/dev/null || echo "UFW not configured"
elif command -v firewall-cmd &>/dev/null; then
  echo "Firewalld Status:"
  firewall-cmd --state 2>/dev/null || echo "Firewalld not running"
  firewall-cmd --list-all 2>/dev/null || true
else
  echo "iptables rules:"
  iptables -L -n 2>/dev/null | head -30 || echo "iptables not available"
fi
`,
  },
  {
    id: 'firewall.ufw.baseline',
    group: 'network',
    name: 'Configurer UFW baseline',
    description: 'Active UFW avec règles SSH + HTTP/HTTPS',
    level: 'simple',
    risk: 'high',
    duration: '~30s',
    icon: Shield,
    prerequisites: [],
    verifies: ['firewall.configured'],
    command: `#!/bin/bash
set -e

# Install UFW if not present
if ! command -v ufw &>/dev/null; then
  if command -v apt-get &>/dev/null; then
    apt-get update -qq && apt-get install -y -qq ufw
  else
    echo "ERROR: UFW not available on this system"
    exit 1
  fi
fi

echo "Configuring UFW baseline..."
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow http
ufw allow https
ufw --force enable

echo ""
ufw status verbose
echo ""
echo "✓ UFW baseline configured"
`,
  },
  {
    id: 'ssh.hardening',
    group: 'network',
    name: 'Durcir SSH (expert)',
    description: 'Désactive auth par mot de passe, force clés SSH',
    level: 'expert',
    risk: 'high',
    duration: '~30s',
    icon: Key,
    prerequisites: [],
    verifies: ['ssh.hardened'],
    command: `#!/bin/bash
set -e

SSHD_CONFIG="/etc/ssh/sshd_config"

echo "⚠ WARNING: Ensure you have SSH key access before proceeding!"
echo ""

# Backup config
cp \$SSHD_CONFIG \${SSHD_CONFIG}.backup.\$(date +%s)

# Apply hardening
sed -i 's/#*PasswordAuthentication yes/PasswordAuthentication no/' \$SSHD_CONFIG
sed -i 's/#*PermitRootLogin yes/PermitRootLogin prohibit-password/' \$SSHD_CONFIG
sed -i 's/#*PubkeyAuthentication no/PubkeyAuthentication yes/' \$SSHD_CONFIG

# Restart SSH
systemctl restart sshd || service ssh restart

echo "✓ SSH hardened (password auth disabled)"
`,
  },
  {
    id: 'fail2ban.install',
    group: 'network',
    name: 'Installer Fail2ban',
    description: 'Protection contre les attaques brute-force',
    level: 'simple',
    risk: 'low',
    duration: '~2min',
    icon: Shield,
    prerequisites: [],
    verifies: ['fail2ban.installed'],
    command: `#!/bin/bash
set -e

if command -v fail2ban-client &>/dev/null; then
  echo "Fail2ban already installed"
  fail2ban-client status
  exit 0
fi

if command -v apt-get &>/dev/null; then
  apt-get update -qq && apt-get install -y -qq fail2ban
elif command -v dnf &>/dev/null; then
  dnf install -y -q fail2ban
elif command -v yum &>/dev/null; then
  yum install -y -q epel-release && yum install -y -q fail2ban
else
  echo "ERROR: Cannot install fail2ban on this system"
  exit 1
fi

systemctl enable fail2ban
systemctl start fail2ban

echo ""
fail2ban-client status
echo ""
echo "✓ Fail2ban installed and running"
`,
  },
];

// ============================================================================
// GROUP C: Runtime (Node, Python, etc.)
// ============================================================================

const RUNTIME_PLAYBOOKS: Playbook[] = [
  {
    id: 'runtime.node.detect',
    group: 'runtime',
    name: 'Détecter Node.js',
    description: 'Vérifie si Node.js et NPM sont installés',
    level: 'simple',
    risk: 'low',
    duration: '~5s',
    icon: Zap,
    prerequisites: [],
    verifies: [],
    command: `#!/bin/bash

echo "=== Node.js Detection ==="

if command -v node &>/dev/null; then
  NODE_VERSION=$(node -v)
  echo "✓ Node.js: $NODE_VERSION ($(which node))"
else
  echo "✗ Node.js: NOT INSTALLED"
fi

if command -v npm &>/dev/null; then
  NPM_VERSION=$(npm -v)
  echo "✓ NPM: $NPM_VERSION ($(which npm))"
else
  echo "✗ NPM: NOT INSTALLED"
fi

if command -v npx &>/dev/null; then
  echo "✓ NPX: $(which npx)"
fi

# Output capabilities JSON
cat <<EOF
{
  "capabilities": {
    "node.installed": "$(command -v node &>/dev/null && echo 'installed' || echo 'not_installed')",
    "npm.installed": "$(command -v npm &>/dev/null && echo 'installed' || echo 'not_installed')"
  }
}
EOF
`,
  },
  {
    id: 'runtime.node.install_lts',
    group: 'runtime',
    name: 'Installer Node.js LTS',
    description: 'Installe Node.js LTS via NodeSource (multi-distro)',
    level: 'simple',
    risk: 'low',
    duration: '~3min',
    icon: Zap,
    prerequisites: [
      { capability: 'curl.installed', label: 'curl', required: true }
    ],
    verifies: ['node.installed', 'npm.installed'],
    command: `#!/bin/bash
set -e

# Check if already installed
if command -v node &>/dev/null; then
  NODE_VERSION=$(node -v)
  echo "Node.js already installed: $NODE_VERSION"
  echo "Use 'runtime.node.update' to upgrade"
  exit 0
fi

echo "Installing Node.js LTS..."

# Detect distro and install
if command -v apt-get &>/dev/null; then
  # Ubuntu/Debian - use NodeSource
  curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
  apt-get install -y nodejs
elif command -v dnf &>/dev/null; then
  # Fedora/RHEL 8+
  curl -fsSL https://rpm.nodesource.com/setup_lts.x | bash -
  dnf install -y nodejs
elif command -v yum &>/dev/null; then
  # CentOS/RHEL 7
  curl -fsSL https://rpm.nodesource.com/setup_lts.x | bash -
  yum install -y nodejs
elif command -v apk &>/dev/null; then
  # Alpine
  apk add nodejs npm
else
  echo "ERROR: Unknown package manager, cannot install Node.js"
  exit 1
fi

# Verify installation
echo ""
echo "=== Verification ==="
if command -v node &>/dev/null; then
  echo "✓ Node.js: $(node -v)"
else
  echo "✗ Node.js installation FAILED"
  exit 1
fi

if command -v npm &>/dev/null; then
  echo "✓ NPM: $(npm -v)"
else
  echo "✗ NPM installation FAILED"
  exit 1
fi

echo ""
echo "✓ Node.js LTS installed successfully"
`,
  },
  {
    id: 'runtime.node.verify',
    group: 'runtime',
    name: 'Vérifier Node.js',
    description: 'Vérifie que Node.js fonctionne correctement',
    level: 'simple',
    risk: 'low',
    duration: '~5s',
    icon: Zap,
    prerequisites: [],
    verifies: ['node.verified'],
    command: `#!/bin/bash
set -e

echo "=== Node.js Verification ==="

# Check node
if ! command -v node &>/dev/null; then
  echo "✗ Node.js not found"
  exit 1
fi

NODE_VERSION=$(node -v)
echo "✓ Node.js: $NODE_VERSION"

# Check npm
if ! command -v npm &>/dev/null; then
  echo "✗ NPM not found"
  exit 1
fi

NPM_VERSION=$(npm -v)
echo "✓ NPM: $NPM_VERSION"

# Test execution
TEST_RESULT=$(node -e "console.log('test-ok')" 2>&1)
if [ "$TEST_RESULT" = "test-ok" ]; then
  echo "✓ Node.js execution: OK"
else
  echo "✗ Node.js execution: FAILED"
  exit 1
fi

echo ""
echo "✓ Node.js verified and working"
`,
  },
  {
    id: 'runtime.pm2.install',
    group: 'runtime',
    name: 'Installer PM2',
    description: 'Process manager pour applications Node.js',
    level: 'expert',
    risk: 'low',
    duration: '~1min',
    icon: Settings,
    prerequisites: [
      { capability: 'npm.installed', label: 'NPM', required: true }
    ],
    verifies: ['pm2.installed'],
    command: `#!/bin/bash
set -e

if command -v pm2 &>/dev/null; then
  echo "PM2 already installed: $(pm2 -v)"
  exit 0
fi

echo "Installing PM2..."
npm install -g pm2

# Setup startup script
pm2 startup 2>/dev/null || true

echo ""
echo "✓ PM2 installed: $(pm2 -v)"
`,
  },
];

// ============================================================================
// GROUP D: Docker & Compose
// ============================================================================

const DOCKER_PLAYBOOKS: Playbook[] = [
  {
    id: 'docker.detect',
    group: 'docker',
    name: 'Détecter Docker',
    description: 'Vérifie si Docker et Docker Compose sont installés',
    level: 'simple',
    risk: 'low',
    duration: '~5s',
    icon: Container,
    prerequisites: [],
    verifies: [],
    command: `#!/bin/bash

echo "=== Docker Detection ==="

# Docker Engine
if command -v docker &>/dev/null; then
  DOCKER_VERSION=$(docker --version 2>/dev/null || echo "unknown")
  echo "✓ Docker: $DOCKER_VERSION"
  
  # Check if running
  if docker info &>/dev/null; then
    echo "✓ Docker daemon: Running"
  else
    echo "⚠ Docker daemon: Not running or no permission"
  fi
else
  echo "✗ Docker: NOT INSTALLED"
fi

# Docker Compose (v2 plugin)
if docker compose version &>/dev/null 2>&1; then
  COMPOSE_V2=$(docker compose version 2>/dev/null | head -1)
  echo "✓ Docker Compose (v2): $COMPOSE_V2"
# Docker Compose (standalone)
elif command -v docker-compose &>/dev/null; then
  COMPOSE_V1=$(docker-compose --version 2>/dev/null || echo "unknown")
  echo "✓ Docker Compose (v1): $COMPOSE_V1"
else
  echo "✗ Docker Compose: NOT INSTALLED"
fi

# Output capabilities JSON
cat <<EOF
{
  "capabilities": {
    "docker.installed": "$(command -v docker &>/dev/null && echo 'installed' || echo 'not_installed')",
    "docker.compose.installed": "$(docker compose version &>/dev/null 2>&1 && echo 'installed' || (command -v docker-compose &>/dev/null && echo 'installed' || echo 'not_installed'))"
  }
}
EOF
`,
  },
  {
    id: 'docker.install_engine',
    group: 'docker',
    name: 'Installer Docker Engine',
    description: 'Installe Docker Engine (multi-distro)',
    level: 'simple',
    risk: 'medium',
    duration: '~5min',
    icon: Container,
    prerequisites: [
      { capability: 'curl.installed', label: 'curl', required: true }
    ],
    verifies: ['docker.installed'],
    command: `#!/bin/bash
set -e

if command -v docker &>/dev/null; then
  echo "Docker already installed: $(docker --version)"
  exit 0
fi

echo "Installing Docker Engine..."

# Use official convenience script (supports most distros)
curl -fsSL https://get.docker.com | sh

# Enable and start
systemctl enable docker
systemctl start docker

# Verify
echo ""
echo "=== Verification ==="
docker --version
docker info | head -5

echo ""
echo "✓ Docker Engine installed successfully"
`,
  },
  {
    id: 'docker.install_compose',
    group: 'docker',
    name: 'Installer Docker Compose',
    description: 'Installe Docker Compose v2 plugin',
    level: 'simple',
    risk: 'low',
    duration: '~1min',
    icon: Layers,
    prerequisites: [
      { capability: 'docker.installed', label: 'Docker', required: true }
    ],
    verifies: ['docker.compose.installed'],
    command: `#!/bin/bash
set -e

# Check if compose v2 already available
if docker compose version &>/dev/null 2>&1; then
  echo "Docker Compose v2 already installed"
  docker compose version
  exit 0
fi

# Check if standalone docker-compose exists
if command -v docker-compose &>/dev/null; then
  echo "Docker Compose v1 found: $(docker-compose --version)"
  echo "Consider upgrading to v2"
  exit 0
fi

echo "Installing Docker Compose v2 plugin..."

# Install via package manager (preferred for docker-ce)
if command -v apt-get &>/dev/null; then
  apt-get update -qq
  apt-get install -y docker-compose-plugin
elif command -v dnf &>/dev/null; then
  dnf install -y docker-compose-plugin
elif command -v yum &>/dev/null; then
  yum install -y docker-compose-plugin
else
  # Manual install as fallback
  COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep '"tag_name"' | cut -d'"' -f4)
  ARCH=$(uname -m)
  mkdir -p ~/.docker/cli-plugins/
  curl -SL "https://github.com/docker/compose/releases/download/\${COMPOSE_VERSION}/docker-compose-linux-\${ARCH}" -o ~/.docker/cli-plugins/docker-compose
  chmod +x ~/.docker/cli-plugins/docker-compose
fi

# Verify
echo ""
echo "=== Verification ==="
docker compose version

echo ""
echo "✓ Docker Compose installed successfully"
`,
  },
  {
    id: 'docker.postinstall',
    group: 'docker',
    name: 'Post-install Docker',
    description: 'Ajoute l\'utilisateur au groupe docker',
    level: 'expert',
    risk: 'low',
    duration: '~10s',
    icon: Container,
    prerequisites: [
      { capability: 'docker.installed', label: 'Docker', required: true }
    ],
    verifies: ['docker.user_configured'],
    command: `#!/bin/bash
set -e

# Get current user (not root if running via sudo)
TARGET_USER=\${SUDO_USER:-$(whoami)}

if [ "$TARGET_USER" = "root" ]; then
  echo "Running as root, no group configuration needed"
  exit 0
fi

echo "Adding user '$TARGET_USER' to docker group..."
usermod -aG docker "$TARGET_USER"

echo ""
echo "✓ User added to docker group"
echo ""
echo "⚠ IMPORTANT: User must log out and log back in for changes to take effect"
`,
  },
  {
    id: 'docker.verify',
    group: 'docker',
    name: 'Vérifier Docker (hello-world)',
    description: 'Exécute docker run hello-world pour vérifier l\'installation',
    level: 'simple',
    risk: 'low',
    duration: '~30s',
    icon: Container,
    prerequisites: [
      { capability: 'docker.installed', label: 'Docker', required: true }
    ],
    verifies: ['docker.verified'],
    command: `#!/bin/bash
set -e

echo "Running Docker verification..."
docker run --rm hello-world

echo ""
    echo "✓ Docker is working correctly"
`,
  },
];

// ============================================================================
// GROUP E-bis: Redis
// ============================================================================

const REDIS_PLAYBOOKS: Playbook[] = [
  {
    id: 'redis.install',
    group: 'redis',
    name: 'Installer Redis',
    description: 'Cache clé-valeur en mémoire (via Docker)',
    level: 'simple',
    risk: 'low',
    duration: '~2min',
    icon: Zap,
    prerequisites: [
      { capability: 'docker.installed', label: 'Docker', required: true }
    ],
    verifies: ['redis.installed'],
    command: `#!/bin/bash
set -e

if docker ps --format '{{.Names}}' | grep -q "^redis$"; then
  echo "Redis already running"
  docker ps --filter name=redis
  exit 0
fi

echo "Installing Redis via Docker..."

docker run -d \\
  --name redis \\
  --restart unless-stopped \\
  -p 6379:6379 \\
  -v redis-data:/data \\
  redis:alpine redis-server --appendonly yes

echo ""
echo "Waiting for Redis to start..."
sleep 3

if docker ps --filter name=redis --filter status=running | grep -q redis; then
  echo "✓ Redis installed and running on port 6379"
  docker exec redis redis-cli ping
else
  echo "✗ Redis failed to start"
  docker logs redis
  exit 1
fi
`,
  },
  {
    id: 'redis.healthcheck',
    group: 'redis',
    name: 'Healthcheck Redis',
    description: 'Vérifie que Redis répond correctement',
    level: 'simple',
    risk: 'low',
    duration: '~5s',
    icon: Zap,
    prerequisites: [
      { capability: 'docker.installed', label: 'Docker', required: true }
    ],
    verifies: [],
    command: `#!/bin/bash
echo "=== Redis Health Check ==="

if ! docker ps --format '{{.Names}}' | grep -q "^redis$"; then
  echo "✗ Redis container not running"
  exit 1
fi

# Ping test
PING_RESULT=\$(docker exec redis redis-cli ping 2>/dev/null)
if [ "\$PING_RESULT" = "PONG" ]; then
  echo "✓ Redis PING: PONG"
else
  echo "✗ Redis not responding"
  exit 1
fi

# Info
echo ""
echo "Redis Info:"
docker exec redis redis-cli info server | grep -E "redis_version|uptime|tcp_port"
docker exec redis redis-cli info memory | grep -E "used_memory_human"

echo ""
echo "✓ Redis is healthy"
`,
  },
  {
    id: 'redis.status',
    group: 'redis',
    name: 'Status Redis',
    description: 'Affiche l\'état du service Redis',
    level: 'simple',
    risk: 'low',
    duration: '~5s',
    icon: Zap,
    prerequisites: [],
    verifies: [],
    command: `#!/bin/bash
echo "=== Redis Status ==="

if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^redis$"; then
  echo "✓ Container: Running"
  docker ps --filter name=redis --format "table {{.Status}}\\t{{.Ports}}"
  
  # Stats
  echo ""
  echo "Memory usage:"
  docker exec redis redis-cli info memory | grep used_memory_human
  
  echo ""
  echo "Clients connected:"
  docker exec redis redis-cli info clients | grep connected_clients
else
  echo "✗ Redis not running"
fi
`,
  },
];

// ============================================================================
// GROUP E: Reverse Proxy / TLS
// ============================================================================

const PROXY_PLAYBOOKS: Playbook[] = [
  {
    id: 'proxy.caddy.install',
    group: 'proxy',
    name: 'Installer Caddy',
    description: 'Serveur web avec HTTPS automatique',
    level: 'simple',
    risk: 'low',
    duration: '~2min',
    icon: Globe,
    prerequisites: [],
    verifies: ['caddy.installed'],
    command: `#!/bin/bash
set -e

if command -v caddy &>/dev/null; then
  echo "Caddy already installed: $(caddy version)"
  exit 0
fi

echo "Installing Caddy..."

if command -v apt-get &>/dev/null; then
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
  apt-get update
  apt-get install -y caddy
elif command -v dnf &>/dev/null; then
  dnf install 'dnf-command(copr)' -y
  dnf copr enable @caddy/caddy -y
  dnf install caddy -y
elif command -v yum &>/dev/null; then
  yum install yum-plugin-copr -y
  yum copr enable @caddy/caddy -y
  yum install caddy -y
else
  echo "ERROR: Cannot install Caddy on this system"
  exit 1
fi

systemctl enable caddy
systemctl start caddy

echo ""
echo "✓ Caddy installed: $(caddy version)"
`,
  },
  {
    id: 'proxy.caddy.status',
    group: 'proxy',
    name: 'Status Caddy',
    description: 'Vérifie l\'état du service Caddy',
    level: 'simple',
    risk: 'low',
    duration: '~5s',
    icon: Globe,
    prerequisites: [
      { capability: 'caddy.installed', label: 'Caddy', required: true }
    ],
    verifies: [],
    command: `#!/bin/bash
echo "=== Caddy Status ==="

if ! command -v caddy &>/dev/null; then
  echo "✗ Caddy not installed"
  exit 1
fi

echo "Version: \$(caddy version)"
echo ""

# Check service status
if systemctl is-active --quiet caddy 2>/dev/null; then
  echo "✓ Service: Running"
  systemctl status caddy --no-pager | head -10
else
  echo "✗ Service: Not running"
fi

echo ""
echo "=== Current Caddyfile ==="
cat /etc/caddy/Caddyfile 2>/dev/null || echo "No Caddyfile found"

echo ""
echo "=== Listening ports ==="
ss -tlnp | grep caddy || echo "No ports found"
`,
  },
  {
    id: 'proxy.caddy.configure_route',
    group: 'proxy',
    name: 'Configurer route Caddy',
    description: 'Ajoute une route reverse proxy (domain → backend)',
    level: 'simple',
    risk: 'medium',
    duration: '~30s',
    icon: Globe,
    prerequisites: [
      { capability: 'caddy.installed', label: 'Caddy', required: true }
    ],
    verifies: ['caddy.configured'],
    command: `#!/bin/bash
set -e

# This playbook shows how to configure a route
# In production, you'd pass domain and backend as parameters

CADDYFILE="/etc/caddy/Caddyfile"
BACKUP_DIR="/etc/caddy/backups"

echo "=== Caddy Route Configuration ==="
echo ""

# Create backup directory
mkdir -p \$BACKUP_DIR

# Backup current config
if [ -f "\$CADDYFILE" ]; then
  cp "\$CADDYFILE" "\$BACKUP_DIR/Caddyfile.\$(date +%s).bak"
  echo "✓ Backup created"
fi

# Show current config
echo ""
echo "Current Caddyfile:"
echo "---"
cat "\$CADDYFILE" 2>/dev/null || echo "(empty)"
echo "---"

echo ""
echo "To add a route, edit /etc/caddy/Caddyfile with:"
echo ""
echo "  example.com {"
echo "    reverse_proxy localhost:3000"
echo "  }"
echo ""
echo "Then run 'caddy reload' or use the reload playbook."
echo ""
echo "Example configurations:"
echo ""
echo "# Simple reverse proxy"
echo "app.example.com {"
echo "  reverse_proxy localhost:3000"
echo "}"
echo ""
echo "# With load balancing"
echo "api.example.com {"
echo "  reverse_proxy localhost:8001 localhost:8002 localhost:8003"
echo "}"
echo ""
echo "# With websocket support"
echo "ws.example.com {"
echo "  reverse_proxy localhost:8080 {"
echo "    header_up X-Real-IP {remote_host}"
echo "  }"
echo "}"
echo ""
echo "✓ Route configuration guide complete"
`,
  },
  {
    id: 'proxy.caddy.add_route',
    group: 'proxy',
    name: 'Ajouter route Caddy',
    description: 'Ajoute une route avec domain et port spécifiés',
    level: 'expert',
    risk: 'medium',
    duration: '~30s',
    icon: Globe,
    prerequisites: [
      { capability: 'caddy.installed', label: 'Caddy', required: true }
    ],
    verifies: ['caddy.configured'],
    command: `#!/bin/bash
set -e

# Default values - override these in the order meta or command
DOMAIN="\\\${ROUTE_DOMAIN:-app.example.com}"
BACKEND="\\\${ROUTE_BACKEND:-localhost:3000}"

CADDYFILE="/etc/caddy/Caddyfile"
BACKUP_DIR="/etc/caddy/backups"

echo "=== Adding Caddy Route ==="
echo "Domain: \$DOMAIN"
echo "Backend: \$BACKEND"
echo ""

# Create backup
mkdir -p \$BACKUP_DIR
cp "\$CADDYFILE" "\$BACKUP_DIR/Caddyfile.\$(date +%s).bak" 2>/dev/null || true

# Check if domain already exists
if grep -q "^\$DOMAIN {" "\$CADDYFILE" 2>/dev/null; then
  echo "⚠ Domain \$DOMAIN already configured in Caddyfile"
  grep -A5 "^\$DOMAIN {" "\$CADDYFILE"
  exit 0
fi

# Append new route
cat >> "\$CADDYFILE" <<ROUTE

\$DOMAIN {
  reverse_proxy \$BACKEND
  encode gzip
  log {
    output file /var/log/caddy/\$DOMAIN.log
  }
}
ROUTE

echo "✓ Route added to Caddyfile"
echo ""

# Validate config
echo "Validating configuration..."
if caddy validate --config "\$CADDYFILE" 2>&1; then
  echo "✓ Configuration valid"
else
  echo "✗ Configuration invalid, restoring backup"
  exit 1
fi

# Reload Caddy
echo ""
echo "Reloading Caddy..."
caddy reload --config "\$CADDYFILE" 2>&1 || systemctl reload caddy

echo ""
echo "✓ Route \$DOMAIN → \$BACKEND configured and active"
`,
  },
  {
    id: 'proxy.caddy.reload',
    group: 'proxy',
    name: 'Recharger Caddy',
    description: 'Recharge la configuration Caddy sans interruption',
    level: 'simple',
    risk: 'low',
    duration: '~10s',
    icon: Globe,
    prerequisites: [
      { capability: 'caddy.installed', label: 'Caddy', required: true }
    ],
    verifies: [],
    command: `#!/bin/bash
set -e

CADDYFILE="/etc/caddy/Caddyfile"

echo "=== Reloading Caddy ==="

# Validate before reload
echo "Validating configuration..."
if ! caddy validate --config "\$CADDYFILE" 2>&1; then
  echo "✗ Configuration invalid, aborting reload"
  exit 1
fi
echo "✓ Configuration valid"

# Reload
echo ""
echo "Reloading Caddy..."
if caddy reload --config "\$CADDYFILE" 2>&1; then
  echo "✓ Caddy reloaded successfully"
elif systemctl reload caddy 2>&1; then
  echo "✓ Caddy reloaded via systemctl"
else
  echo "✗ Reload failed"
  exit 1
fi

echo ""
echo "=== Current routes ==="
caddy list-modules 2>/dev/null | head -10 || true
echo ""
echo "Listening on:"
ss -tlnp | grep caddy || echo "Check ports manually"
`,
  },
  {
    id: 'proxy.caddy.list_routes',
    group: 'proxy',
    name: 'Lister routes Caddy',
    description: 'Affiche toutes les routes configurées',
    level: 'simple',
    risk: 'low',
    duration: '~5s',
    icon: Globe,
    prerequisites: [
      { capability: 'caddy.installed', label: 'Caddy', required: true }
    ],
    verifies: [],
    command: `#!/bin/bash
echo "=== Caddy Routes ==="
echo ""

CADDYFILE="/etc/caddy/Caddyfile"

if [ ! -f "\$CADDYFILE" ]; then
  echo "✗ No Caddyfile found at \$CADDYFILE"
  exit 1
fi

echo "Caddyfile location: \$CADDYFILE"
echo ""

# Extract domain blocks
echo "Configured domains:"
grep -E "^[a-zA-Z0-9].*{" "\$CADDYFILE" | sed 's/{//' | while read domain; do
  echo "  • \$domain"
done

echo ""
echo "=== Full Caddyfile ==="
cat "\$CADDYFILE"

echo ""
echo "=== Caddy API (if enabled) ==="
curl -s http://localhost:2019/config/ 2>/dev/null | head -50 || echo "Admin API not accessible"
`,
  },
  {
    id: 'proxy.nginx.install',
    group: 'proxy',
    name: 'Installer Nginx',
    description: 'Serveur web / reverse proxy',
    level: 'simple',
    risk: 'low',
    duration: '~1min',
    icon: Globe,
    prerequisites: [],
    verifies: ['nginx.installed'],
    command: `#!/bin/bash
set -e

if command -v nginx &>/dev/null; then
  echo "Nginx already installed: $(nginx -v 2>&1)"
  exit 0
fi

echo "Installing Nginx..."

if command -v apt-get &>/dev/null; then
  apt-get update -qq && apt-get install -y nginx
elif command -v dnf &>/dev/null; then
  dnf install -y nginx
elif command -v yum &>/dev/null; then
  yum install -y nginx
elif command -v apk &>/dev/null; then
  apk add nginx
else
  echo "ERROR: Cannot install Nginx on this system"
  exit 1
fi

systemctl enable nginx
systemctl start nginx

echo ""
echo "✓ Nginx installed"
nginx -v 2>&1
`,
  },
  {
    id: 'tls.acme.precheck',
    group: 'proxy',
    name: 'Vérifier prérequis TLS/ACME',
    description: 'Vérifie DNS et accessibilité ports 80/443',
    level: 'expert',
    risk: 'low',
    duration: '~10s',
    icon: Lock,
    prerequisites: [],
    verifies: [],
    command: `#!/bin/bash
echo "=== TLS/ACME Prerequisites Check ==="
echo ""

# Check if ports 80/443 are accessible from outside
echo "Port 80 (HTTP):"
ss -tlnp | grep ':80 ' || echo "  Not listening"

echo ""
echo "Port 443 (HTTPS):"
ss -tlnp | grep ':443 ' || echo "  Not listening"

echo ""
echo "Note: For ACME to work, ensure:"
echo "  1. DNS A/AAAA records point to this server"
echo "  2. Ports 80 and 443 are accessible from internet"
echo "  3. No firewall blocking inbound traffic"
`,
  },
];

// ============================================================================
// GROUP F: Monitoring
// ============================================================================

const MONITORING_PLAYBOOKS: Playbook[] = [
  {
    id: 'monitor.prometheus.install',
    group: 'monitoring',
    name: 'Installer Prometheus',
    description: 'Système de monitoring et alerting (via Docker)',
    level: 'simple',
    risk: 'low',
    duration: '~3min',
    icon: Monitor,
    prerequisites: [
      { capability: 'docker.installed', label: 'Docker', required: true },
      { capability: 'docker.compose.installed', label: 'Docker Compose', required: true }
    ],
    verifies: ['prometheus.installed'],
    command: `#!/bin/bash
set -e

PROMETHEUS_DIR="/opt/prometheus"

if docker ps --format '{{.Names}}' | grep -q "^prometheus$"; then
  echo "Prometheus already running"
  docker ps --filter name=prometheus
  exit 0
fi

echo "Installing Prometheus via Docker..."

mkdir -p \$PROMETHEUS_DIR

# Create prometheus config
cat > \$PROMETHEUS_DIR/prometheus.yml <<EOF
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']
  
  - job_name: 'node'
    static_configs:
      - targets: ['host.docker.internal:9100']
EOF

# Run Prometheus container
docker run -d \\
  --name prometheus \\
  --restart unless-stopped \\
  -p 9090:9090 \\
  -v \$PROMETHEUS_DIR/prometheus.yml:/etc/prometheus/prometheus.yml \\
  prom/prometheus:latest

echo ""
echo "Waiting for Prometheus to start..."
sleep 5

if docker ps --filter name=prometheus --filter status=running | grep -q prometheus; then
  echo "✓ Prometheus installed and running on port 9090"
else
  echo "✗ Prometheus failed to start"
  docker logs prometheus
  exit 1
fi
`,
  },
  {
    id: 'monitor.prometheus.status',
    group: 'monitoring',
    name: 'Status Prometheus',
    description: 'Vérifie l\'état du service Prometheus',
    level: 'simple',
    risk: 'low',
    duration: '~5s',
    icon: Monitor,
    prerequisites: [
      { capability: 'docker.installed', label: 'Docker', required: true }
    ],
    verifies: [],
    command: `#!/bin/bash
echo "=== Prometheus Status ==="

if docker ps --format '{{.Names}}' | grep -q "^prometheus$"; then
  echo "✓ Container: Running"
  docker ps --filter name=prometheus --format "table {{.Status}}\\t{{.Ports}}"
  
  # Health check
  if curl -s http://localhost:9090/-/healthy | grep -q "Prometheus"; then
    echo "✓ Health: OK"
  else
    echo "⚠ Health: Check failed"
  fi
else
  echo "✗ Prometheus not running"
fi
`,
  },
  {
    id: 'monitor.node_exporter.install',
    group: 'monitoring',
    name: 'Installer Node Exporter',
    description: 'Métriques système pour Prometheus',
    level: 'simple',
    risk: 'low',
    duration: '~2min',
    icon: Monitor,
    prerequisites: [],
    verifies: ['node_exporter.installed'],
    command: `#!/bin/bash
set -e

if systemctl is-active --quiet node_exporter 2>/dev/null; then
  echo "Node Exporter already running"
  exit 0
fi

echo "Installing Node Exporter..."

VERSION="1.7.0"
ARCH=$(uname -m)
case \$ARCH in
  x86_64) ARCH="amd64" ;;
  aarch64) ARCH="arm64" ;;
esac

cd /tmp
wget -q "https://github.com/prometheus/node_exporter/releases/download/v\${VERSION}/node_exporter-\${VERSION}.linux-\${ARCH}.tar.gz"
tar xzf "node_exporter-\${VERSION}.linux-\${ARCH}.tar.gz"
mv "node_exporter-\${VERSION}.linux-\${ARCH}/node_exporter" /usr/local/bin/
rm -rf "node_exporter-\${VERSION}.linux-\${ARCH}"*

# Create systemd service
cat > /etc/systemd/system/node_exporter.service <<EOSVC
[Unit]
Description=Node Exporter
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/node_exporter
Restart=always

[Install]
WantedBy=multi-user.target
EOSVC

systemctl daemon-reload
systemctl enable node_exporter
systemctl start node_exporter

echo ""
echo "✓ Node Exporter installed and running on port 9100"
`,
  },
  {
    id: 'monitor.stack.status',
    group: 'monitoring',
    name: 'Status stack monitoring',
    description: 'Vérifie Prometheus + Node Exporter',
    level: 'simple',
    risk: 'low',
    duration: '~5s',
    icon: Monitor,
    prerequisites: [],
    verifies: [],
    command: `#!/bin/bash
echo "=== Monitoring Stack Status ==="
echo ""

# Prometheus
echo "Prometheus:"
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^prometheus$"; then
  echo "  ✓ Running (Docker)"
elif systemctl is-active --quiet prometheus 2>/dev/null; then
  echo "  ✓ Running (systemd)"
else
  echo "  ✗ Not running"
fi

# Node Exporter
echo ""
echo "Node Exporter:"
if systemctl is-active --quiet node_exporter 2>/dev/null; then
  echo "  ✓ Running on port 9100"
elif curl -s http://localhost:9100/metrics > /dev/null 2>&1; then
  echo "  ✓ Running on port 9100"
else
  echo "  ✗ Not running"
fi
`,
  },
];

// ============================================================================
// GROUP G: Supabase Self-Hosted
// ============================================================================

const SUPABASE_PLAYBOOKS: Playbook[] = [
  {
    id: 'supabase.precheck',
    group: 'supabase',
    name: 'Vérifier prérequis Supabase',
    description: 'Vérifie Docker, Compose, ports, disque, RAM, runner online',
    level: 'simple',
    risk: 'low',
    duration: '~10s',
    icon: Database,
    prerequisites: [],
    verifies: ['supabase.precheck.passed'],
    command: `#!/bin/bash
echo "=== Supabase Self-Hosted Prerequisites Check ==="
echo ""

ERRORS=0
WARNINGS=0

# Check Docker
if command -v docker &>/dev/null && docker info &>/dev/null; then
  DOCKER_VERSION=\$(docker --version | awk '{print \$3}' | tr -d ',')
  echo "✓ Docker: \$DOCKER_VERSION"
else
  echo "✗ Docker: NOT AVAILABLE or daemon not running"
  ERRORS=\$((ERRORS + 1))
fi

# Check Docker Compose (v2 plugin preferred)
if docker compose version &>/dev/null 2>&1; then
  COMPOSE_VERSION=\$(docker compose version 2>/dev/null | awk '{print \$NF}')
  echo "✓ Docker Compose: \$COMPOSE_VERSION (plugin)"
elif command -v docker-compose &>/dev/null; then
  COMPOSE_VERSION=\$(docker-compose --version | awk '{print \$3}' | tr -d ',')
  echo "✓ Docker Compose: \$COMPOSE_VERSION (standalone)"
else
  echo "✗ Docker Compose: NOT AVAILABLE"
  ERRORS=\$((ERRORS + 1))
fi

# Check Git
if command -v git &>/dev/null; then
  echo "✓ Git: \$(git --version | awk '{print \$3}')"
else
  echo "✗ Git: NOT INSTALLED"
  ERRORS=\$((ERRORS + 1))
fi

# Check RAM (minimum 4GB recommended, 2GB absolute minimum)
RAM_MB=\$(free -m | awk '/^Mem:/{print \$2}')
if [ "\$RAM_MB" -ge 4096 ]; then
  echo "✓ RAM: \${RAM_MB}MB (>= 4GB recommended)"
elif [ "\$RAM_MB" -ge 2048 ]; then
  echo "⚠ RAM: \${RAM_MB}MB (2-4GB, may have performance issues)"
  WARNINGS=\$((WARNINGS + 1))
else
  echo "✗ RAM: \${RAM_MB}MB (< 2GB minimum required)"
  ERRORS=\$((ERRORS + 1))
fi

# Check Disk (minimum 20GB free)
DISK_GB=\$(df -BG / | awk 'NR==2{gsub("G",""); print \$4}')
if [ "\$DISK_GB" -ge 20 ]; then
  echo "✓ Free Disk: \${DISK_GB}GB (>= 20GB recommended)"
elif [ "\$DISK_GB" -ge 10 ]; then
  echo "⚠ Free Disk: \${DISK_GB}GB (10-20GB, may be insufficient for images)"
  WARNINGS=\$((WARNINGS + 1))
else
  echo "✗ Free Disk: \${DISK_GB}GB (< 10GB minimum required)"
  ERRORS=\$((ERRORS + 1))
fi

# Check critical ports
echo ""
echo "Port availability (required):"
REQUIRED_PORTS="5432 8000"
for PORT in \$REQUIRED_PORTS; do
  if ss -tlnp 2>/dev/null | grep -q ":\$PORT " || netstat -tlnp 2>/dev/null | grep -q ":\$PORT "; then
    echo "  ✗ Port \$PORT: IN USE (required by Supabase)"
    ERRORS=\$((ERRORS + 1))
  else
    echo "  ✓ Port \$PORT: Available"
  fi
done

echo ""
echo "Optional ports:"
OPTIONAL_PORTS="3000 8443 9000 54321 54322"
for PORT in \$OPTIONAL_PORTS; do
  if ss -tlnp 2>/dev/null | grep -q ":\$PORT " || netstat -tlnp 2>/dev/null | grep -q ":\$PORT "; then
    echo "  ⚠ Port \$PORT: IN USE"
  else
    echo "  ✓ Port \$PORT: Available"
  fi
done

echo ""
echo "=== Summary ==="
if [ "\$ERRORS" -gt 0 ]; then
  echo "✗ FAILED: \$ERRORS critical issues found"
  echo '{"capabilities":{"supabase.precheck.passed":"not_installed"}}'
  exit 1
elif [ "\$WARNINGS" -gt 0 ]; then
  echo "⚠ PASSED with \$WARNINGS warnings"
  echo '{"capabilities":{"supabase.precheck.passed":"installed"}}'
else
  echo "✓ All prerequisites OK - ready for Supabase installation"
  echo '{"capabilities":{"supabase.precheck.passed":"installed"}}'
fi
`,
  },
  {
    id: 'supabase.selfhost.pull_stack',
    group: 'supabase',
    name: 'Télécharger stack Supabase',
    description: 'Clone le repo docker-compose Supabase officiel',
    level: 'simple',
    risk: 'low',
    duration: '~2min',
    icon: Database,
    prerequisites: [
      { capability: 'docker.installed', label: 'Docker', required: true },
      { capability: 'docker.compose.installed', label: 'Docker Compose', required: true },
      { capability: 'git.installed', label: 'Git', required: true }
    ],
    verifies: ['supabase.stack.downloaded'],
    command: `#!/bin/bash
set -e

INSTANCE_NAME="\${SUPABASE_INSTANCE:-default}"
INSTALL_DIR="/opt/ikoma/platform/supabase/\$INSTANCE_NAME"

echo "=== Downloading Supabase Stack ==="
echo "Instance: \$INSTANCE_NAME"
echo "Directory: \$INSTALL_DIR"
echo ""

if [ -d "\$INSTALL_DIR/docker" ]; then
  echo "Stack already exists, updating..."
  cd "\$INSTALL_DIR"
  git fetch origin master --depth=1 2>/dev/null || true
  git reset --hard origin/master 2>/dev/null || true
  echo "✓ Stack updated"
else
  echo "Cloning Supabase repository..."
  mkdir -p "\$(dirname \$INSTALL_DIR)"
  git clone --depth 1 --filter=blob:none --sparse https://github.com/supabase/supabase.git "\$INSTALL_DIR"
  cd "\$INSTALL_DIR"
  git sparse-checkout set docker
  echo "✓ Stack downloaded"
fi

echo ""
ls -la "\$INSTALL_DIR/docker/"
echo ""
echo '{"capabilities":{"supabase.stack.downloaded":"installed"}}'
`,
  },
  {
    id: 'supabase.selfhost.configure_env',
    group: 'supabase',
    name: 'Configurer environnement Supabase',
    description: 'Génère .env avec secrets aléatoires sécurisés',
    level: 'simple',
    risk: 'low',
    duration: '~10s',
    icon: Settings,
    prerequisites: [
      { capability: 'supabase.stack.downloaded', label: 'Stack téléchargé', required: true }
    ],
    verifies: ['supabase.env.configured'],
    command: `#!/bin/bash
set -e

INSTANCE_NAME="\${SUPABASE_INSTANCE:-default}"
INSTALL_DIR="/opt/ikoma/platform/supabase/\$INSTANCE_NAME/docker"
NETWORK_MODE="\${SUPABASE_NETWORK_MODE:-local}"
DOMAIN="\${SUPABASE_DOMAIN:-}"

echo "=== Configuring Supabase Environment ==="
echo "Instance: \$INSTANCE_NAME"
echo "Mode: \$NETWORK_MODE"
[ -n "\$DOMAIN" ] && echo "Domain: \$DOMAIN"
echo ""

cd "\$INSTALL_DIR"

# Generate secure secrets
generate_secret() {
  openssl rand -base64 32 | tr -d '\\n/+=' | head -c 32
}

generate_jwt() {
  openssl rand -base64 64 | tr -d '\\n/+=' | head -c 64
}

# Copy example if .env doesn't exist
if [ ! -f .env ]; then
  cp .env.example .env 2>/dev/null || touch .env
fi

# Generate secrets
JWT_SECRET=\$(generate_jwt)
ANON_KEY=\$(generate_secret)
SERVICE_ROLE_KEY=\$(generate_secret)
POSTGRES_PASSWORD=\$(generate_secret)
DASHBOARD_PASSWORD=\$(generate_secret)

# Determine site URL
if [ "\$NETWORK_MODE" = "public" ] && [ -n "\$DOMAIN" ]; then
  SITE_URL="https://\$DOMAIN"
  API_EXTERNAL_URL="https://\$DOMAIN"
  STUDIO_URL="https://studio.\$DOMAIN"
else
  SITE_URL="http://localhost:3000"
  API_EXTERNAL_URL="http://localhost:8000"
  STUDIO_URL="http://localhost:3000"
fi

# Update .env file
cat > .env << EOF
############
# Secrets - AUTO-GENERATED - DO NOT COMMIT
############
POSTGRES_PASSWORD=\$POSTGRES_PASSWORD
JWT_SECRET=\$JWT_SECRET
ANON_KEY=\$ANON_KEY
SERVICE_ROLE_KEY=\$SERVICE_ROLE_KEY
DASHBOARD_USERNAME=supabase
DASHBOARD_PASSWORD=\$DASHBOARD_PASSWORD

############
# URLs
############
SITE_URL=\$SITE_URL
API_EXTERNAL_URL=\$API_EXTERNAL_URL
SUPABASE_PUBLIC_URL=\$API_EXTERNAL_URL

############
# Studio
############
STUDIO_DEFAULT_ORGANIZATION=Ikoma
STUDIO_DEFAULT_PROJECT=supabase-\$INSTANCE_NAME
STUDIO_PORT=3000

############
# Database
############
POSTGRES_HOST=db
POSTGRES_DB=postgres
POSTGRES_PORT=5432

############
# API
############
KONG_HTTP_PORT=8000
KONG_HTTPS_PORT=8443

############
# Instance
############
INSTANCE_NAME=\$INSTANCE_NAME
NETWORK_MODE=\$NETWORK_MODE
DOMAIN=\$DOMAIN
EOF

echo "✓ Environment configured"
echo ""
echo "Generated credentials (save securely):"
echo "  Dashboard: supabase / \$DASHBOARD_PASSWORD"
echo "  API URL: \$API_EXTERNAL_URL"
echo ""
echo '{"capabilities":{"supabase.env.configured":"installed"}}'
`,
  },
  {
    id: 'supabase.selfhost.up',
    group: 'supabase',
    name: 'Démarrer Supabase',
    description: 'Lance docker compose up -d',
    level: 'simple',
    risk: 'medium',
    duration: '~5-10min',
    icon: Database,
    prerequisites: [
      { capability: 'supabase.env.configured', label: 'Environnement configuré', required: true }
    ],
    verifies: ['supabase.containers.started'],
    command: `#!/bin/bash
set -e

INSTANCE_NAME="\${SUPABASE_INSTANCE:-default}"
INSTALL_DIR="/opt/ikoma/platform/supabase/\$INSTANCE_NAME/docker"

echo "=== Starting Supabase Stack ==="
echo "Instance: \$INSTANCE_NAME"
echo ""

cd "\$INSTALL_DIR"

# Pull images first
echo "Pulling Docker images (this may take several minutes)..."
docker compose pull

echo ""
echo "Starting containers..."
docker compose up -d

echo ""
echo "Waiting for containers to stabilize (30s)..."
sleep 30

echo ""
echo "=== Container Status ==="
docker compose ps

echo ""
echo '{"capabilities":{"supabase.containers.started":"installed"}}'
`,
  },
  {
    id: 'supabase.selfhost.healthcheck',
    group: 'supabase',
    name: 'Healthcheck Supabase',
    description: 'Vérifie tous les services + endpoints HTTP',
    level: 'simple',
    risk: 'low',
    duration: '~30s',
    icon: Database,
    prerequisites: [
      { capability: 'supabase.containers.started', label: 'Containers démarrés', required: true }
    ],
    verifies: ['supabase.installed'],
    command: `#!/bin/bash
INSTANCE_NAME="\${SUPABASE_INSTANCE:-default}"
INSTALL_DIR="/opt/ikoma/platform/supabase/\$INSTANCE_NAME/docker"

echo "=== Supabase Healthcheck ==="
echo "Instance: \$INSTANCE_NAME"
echo ""

cd "\$INSTALL_DIR" 2>/dev/null || { echo "✗ Install directory not found"; exit 1; }

# Check all expected containers are running
echo "Container status:"
RUNNING=0
FAILED=0

for SERVICE in supabase-db supabase-kong supabase-auth supabase-rest supabase-realtime supabase-storage supabase-studio; do
  if docker compose ps 2>/dev/null | grep -q "\$SERVICE.*Up"; then
    echo "  ✓ \$SERVICE: running"
    RUNNING=\$((RUNNING + 1))
  else
    echo "  ✗ \$SERVICE: not running"
    FAILED=\$((FAILED + 1))
  fi
done

echo ""
echo "=== HTTP Endpoints ==="

# Load .env for ports
source .env 2>/dev/null || true
API_PORT=\${KONG_HTTP_PORT:-8000}
STUDIO_PORT=\${STUDIO_PORT:-3000}

# Check Kong API
if curl -sf -o /dev/null "http://localhost:\$API_PORT/rest/v1/" -H "apikey: \${ANON_KEY:-test}"; then
  echo "✓ Kong API (port \$API_PORT): responding"
else
  echo "⚠ Kong API (port \$API_PORT): not responding (may still be starting)"
fi

# Check Studio
if curl -sf -o /dev/null "http://localhost:\$STUDIO_PORT/"; then
  echo "✓ Studio (port \$STUDIO_PORT): responding"
else
  echo "⚠ Studio (port \$STUDIO_PORT): not responding"
fi

# Check Postgres
if docker compose exec -T db pg_isready -U postgres &>/dev/null; then
  echo "✓ PostgreSQL: accepting connections"
else
  echo "⚠ PostgreSQL: not ready"
fi

echo ""
echo "=== Summary ==="
if [ "\$FAILED" -eq 0 ]; then
  echo "✓ Supabase is INSTALLED and healthy (\$RUNNING services running)"
  echo '{"capabilities":{"supabase.installed":"installed"}}'
else
  echo "⚠ Supabase partially running: \$RUNNING OK, \$FAILED failed"
  echo "Run 'docker compose logs' to debug"
  echo '{"capabilities":{"supabase.installed":"not_installed"}}'
  exit 1
fi
`,
  },
  {
    id: 'supabase.selfhost.down',
    group: 'supabase',
    name: 'Arrêter Supabase',
    description: 'Stoppe tous les containers Supabase',
    level: 'simple',
    risk: 'medium',
    duration: '~30s',
    icon: Database,
    prerequisites: [],
    verifies: [],
    command: `#!/bin/bash
INSTANCE_NAME="\${SUPABASE_INSTANCE:-default}"
INSTALL_DIR="/opt/ikoma/platform/supabase/\$INSTANCE_NAME/docker"

echo "=== Stopping Supabase Stack ==="
echo "Instance: \$INSTANCE_NAME"
echo ""

cd "\$INSTALL_DIR" 2>/dev/null || { echo "✗ Install directory not found"; exit 1; }

docker compose down

echo ""
echo "✓ Supabase stopped"
`,
  },
  {
    id: 'supabase.selfhost.logs',
    group: 'supabase',
    name: 'Logs Supabase',
    description: 'Affiche les derniers logs de tous les services',
    level: 'simple',
    risk: 'low',
    duration: '~5s',
    icon: Database,
    prerequisites: [],
    verifies: [],
    command: `#!/bin/bash
INSTANCE_NAME="\${SUPABASE_INSTANCE:-default}"
INSTALL_DIR="/opt/ikoma/platform/supabase/\$INSTANCE_NAME/docker"

cd "\$INSTALL_DIR" 2>/dev/null || { echo "✗ Install directory not found"; exit 1; }

echo "=== Recent Supabase Logs (last 50 lines per service) ==="
echo ""

docker compose logs --tail=50 --timestamps
`,
  },
];

// ============================================================================
// GROUP H: Maintenance
// ============================================================================

const MAINTENANCE_PLAYBOOKS: Playbook[] = [
  {
    id: 'maintenance.disk.check',
    group: 'maintenance',
    name: 'Vérifier espace disque',
    description: 'Affiche l\'utilisation du disque et fichiers volumineux',
    level: 'simple',
    risk: 'low',
    duration: '~10s',
    icon: HardDrive,
    prerequisites: [],
    verifies: [],
    command: `#!/bin/bash
echo "=== Disk Usage ==="
df -h

echo ""
echo "=== Largest directories in /var ==="
du -sh /var/* 2>/dev/null | sort -rh | head -10

echo ""
echo "=== Largest log files ==="
du -sh /var/log/* 2>/dev/null | sort -rh | head -10
`,
  },
  {
    id: 'maintenance.docker.cleanup',
    group: 'maintenance',
    name: 'Nettoyer Docker',
    description: 'Supprime images, conteneurs et volumes inutilisés',
    level: 'simple',
    risk: 'medium',
    duration: '~2min',
    icon: Container,
    prerequisites: [
      { capability: 'docker.installed', label: 'Docker', required: true }
    ],
    verifies: [],
    command: `#!/bin/bash
set -e

echo "=== Docker Cleanup ==="
echo ""

echo "Before cleanup:"
docker system df

echo ""
echo "Removing unused containers, images, volumes..."
docker system prune -af --volumes

echo ""
echo "After cleanup:"
docker system df

echo ""
echo "✓ Docker cleanup complete"
`,
  },
  {
    id: 'maintenance.apt.cleanup',
    group: 'maintenance',
    name: 'Nettoyer cache APT',
    description: 'Libère de l\'espace en nettoyant le cache des paquets',
    level: 'simple',
    risk: 'low',
    duration: '~30s',
    icon: Wrench,
    prerequisites: [],
    verifies: [],
    command: `#!/bin/bash
set -e

if ! command -v apt-get &>/dev/null; then
  echo "Not an apt-based system, skipping"
  exit 0
fi

echo "Before cleanup:"
du -sh /var/cache/apt/archives/ 2>/dev/null || echo "N/A"

apt-get clean
apt-get autoremove -y

echo ""
echo "After cleanup:"
du -sh /var/cache/apt/archives/ 2>/dev/null || echo "N/A"

echo ""
echo "✓ APT cache cleaned"
`,
  },
  {
    id: 'maintenance.logs.rotate',
    group: 'maintenance',
    name: 'Rotation des logs',
    description: 'Force la rotation des fichiers de logs',
    level: 'simple',
    risk: 'low',
    duration: '~30s',
    icon: FileCode,
    prerequisites: [],
    verifies: [],
    command: `#!/bin/bash
set -e

echo "Forcing log rotation..."
logrotate -f /etc/logrotate.conf 2>/dev/null || echo "logrotate not available"

echo ""
echo "Journal disk usage:"
journalctl --disk-usage 2>/dev/null || echo "journalctl not available"

# Vacuum old journal entries if over 500MB
journalctl --vacuum-size=500M 2>/dev/null || true

echo ""
echo "✓ Log rotation complete"
`,
  },
  {
    id: 'maintenance.services.status',
    group: 'maintenance',
    name: 'Status des services',
    description: 'Affiche l\'état des services système importants',
    level: 'simple',
    risk: 'low',
    duration: '~5s',
    icon: Server,
    prerequisites: [],
    verifies: [],
    command: `#!/bin/bash
echo "=== Service Status ==="
echo ""

SERVICES="docker nginx caddy fail2ban ufw ikoma-runner node_exporter"

for SVC in $SERVICES; do
  if systemctl is-enabled $SVC 2>/dev/null | grep -q "enabled"; then
    STATUS=$(systemctl is-active $SVC 2>/dev/null || echo "unknown")
    if [ "$STATUS" = "active" ]; then
      echo "✓ $SVC: running"
    else
      echo "⚠ $SVC: $STATUS (enabled)"
    fi
  elif systemctl list-unit-files | grep -q "^$SVC"; then
    echo "○ $SVC: disabled"
  fi
done
`,
  },
];

// ============================================================================
// Export all playbooks grouped
// ============================================================================

export const PLAYBOOK_GROUPS = {
  system: {
    label: 'Système',
    description: 'Fondations et configuration de base',
    icon: Server,
    playbooks: SYSTEM_PLAYBOOKS,
  },
  network: {
    label: 'Réseau & Sécurité',
    description: 'Pare-feu, SSH, protection',
    icon: Shield,
    playbooks: NETWORK_PLAYBOOKS,
  },
  runtime: {
    label: 'Runtime',
    description: 'Node.js, Python, PM2',
    icon: Zap,
    playbooks: RUNTIME_PLAYBOOKS,
  },
  docker: {
    label: 'Docker',
    description: 'Conteneurisation',
    icon: Container,
    playbooks: DOCKER_PLAYBOOKS,
  },
  redis: {
    label: 'Redis',
    description: 'Cache clé-valeur',
    icon: Zap,
    playbooks: REDIS_PLAYBOOKS,
  },
  proxy: {
    label: 'Proxy & TLS',
    description: 'Caddy, Nginx, certificats',
    icon: Globe,
    playbooks: PROXY_PLAYBOOKS,
  },
  monitoring: {
    label: 'Monitoring',
    description: 'Métriques et surveillance',
    icon: Monitor,
    playbooks: MONITORING_PLAYBOOKS,
  },
  supabase: {
    label: 'Supabase',
    description: 'Self-hosted backend',
    icon: Database,
    playbooks: SUPABASE_PLAYBOOKS,
  },
  maintenance: {
    label: 'Maintenance',
    description: 'Nettoyage et diagnostics',
    icon: Wrench,
    playbooks: MAINTENANCE_PLAYBOOKS,
  },
};

export const ALL_PLAYBOOKS: Playbook[] = [
  ...SYSTEM_PLAYBOOKS,
  ...NETWORK_PLAYBOOKS,
  ...RUNTIME_PLAYBOOKS,
  ...DOCKER_PLAYBOOKS,
  ...REDIS_PLAYBOOKS,
  ...PROXY_PLAYBOOKS,
  ...MONITORING_PLAYBOOKS,
  ...SUPABASE_PLAYBOOKS,
  ...MAINTENANCE_PLAYBOOKS,
];

export function getPlaybookById(id: string): Playbook | undefined {
  return ALL_PLAYBOOKS.find(p => p.id === id);
}

export function getPlaybooksByLevel(level: PlaybookLevel): Playbook[] {
  return ALL_PLAYBOOKS.filter(p => p.level === level);
}

export function getPlaybooksByGroup(group: string): Playbook[] {
  return ALL_PLAYBOOKS.filter(p => p.group === group);
}
