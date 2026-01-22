import { Globe, Lock, Shield, RefreshCw, Trash2 } from 'lucide-react';
import { Playbook } from './playbooks.legacy';

/**
 * Nginx + Certbot Playbooks
 * Complete set of playbooks for Nginx reverse proxy with Let's Encrypt HTTPS
 */

export const NGINX_PLAYBOOKS: Playbook[] = [
  // ============================================================================
  // INSTALLATION
  // ============================================================================
  {
    id: 'proxy.nginx.install_full',
    group: 'proxy',
    name: 'Installer Nginx + Certbot',
    description: 'Nginx reverse proxy avec Certbot pour HTTPS automatique',
    level: 'simple',
    risk: 'low',
    duration: '~2min',
    icon: Globe,
    prerequisites: [],
    verifies: ['nginx.installed', 'certbot.installed'],
    command: `#!/bin/bash
set -e

# Wait for apt lock
wait_for_apt_lock() {
  local max_wait=120
  local waited=0
  while fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1 || fuser /var/lib/apt/lists/lock >/dev/null 2>&1; do
    if [ $waited -ge $max_wait ]; then
      echo "ERROR: Timeout waiting for apt lock"
      exit 1
    fi
    echo "Waiting for apt lock... ($waited/$max_wait)"
    sleep 5
    waited=$((waited + 5))
  done
}

echo "=== Installing Nginx + Certbot ==="
echo ""

# Check if already installed
if command -v nginx &>/dev/null && command -v certbot &>/dev/null; then
  NGINX_VERSION=$(nginx -v 2>&1 | grep -oP 'nginx/\\K[0-9.]+' || echo "unknown")
  CERTBOT_VERSION=$(certbot --version 2>&1 | grep -oP '[0-9]+\\.[0-9.]+' || echo "unknown")
  echo "✓ Already installed"
  echo "  Nginx: $NGINX_VERSION"
  echo "  Certbot: $CERTBOT_VERSION"
  
  # Output JSON for capability parsing
  cat <<EOF
{
  "service": "nginx",
  "installed": true,
  "nginx_version": "$NGINX_VERSION",
  "certbot_version": "$CERTBOT_VERSION",
  "checked_at": "$(date -Iseconds)"
}
EOF
  exit 0
fi

wait_for_apt_lock

# Detect package manager and install
if command -v apt-get &>/dev/null; then
  echo "Installing via apt..."
  apt-get update -qq
  apt-get install -y nginx certbot python3-certbot-nginx
elif command -v dnf &>/dev/null; then
  echo "Installing via dnf..."
  dnf install -y nginx certbot python3-certbot-nginx
elif command -v yum &>/dev/null; then
  echo "Installing via yum..."
  yum install -y epel-release
  yum install -y nginx certbot python3-certbot-nginx
else
  echo "ERROR: Unsupported package manager"
  exit 1
fi

# Enable and start Nginx
systemctl enable nginx
systemctl start nginx

# Create sites directories if they don't exist
mkdir -p /etc/nginx/sites-available
mkdir -p /etc/nginx/sites-enabled

# Ensure sites-enabled is included in nginx.conf
if ! grep -q "sites-enabled" /etc/nginx/nginx.conf; then
  echo "include /etc/nginx/sites-enabled/*;" >> /etc/nginx/nginx.conf
fi

# Test and reload
nginx -t
systemctl reload nginx

NGINX_VERSION=$(nginx -v 2>&1 | grep -oP 'nginx/\\K[0-9.]+' || echo "unknown")
CERTBOT_VERSION=$(certbot --version 2>&1 | grep -oP '[0-9]+\\.[0-9.]+' || echo "unknown")

echo ""
echo "✓ Installation complete"
echo "  Nginx: $NGINX_VERSION"
echo "  Certbot: $CERTBOT_VERSION"

# Output JSON for capability parsing
cat <<EOF
{
  "service": "nginx",
  "installed": true,
  "nginx_version": "$NGINX_VERSION",
  "certbot_version": "$CERTBOT_VERSION",
  "checked_at": "$(date -Iseconds)"
}
EOF
`,
  },

  // ============================================================================
  // VERIFICATION (Runtime proof)
  // ============================================================================
  {
    id: 'proxy.nginx.verify',
    group: 'proxy',
    name: 'Vérifier Nginx Runtime',
    description: 'Vérifie que Nginx est installé et en cours d\'exécution',
    level: 'simple',
    risk: 'low',
    duration: '~5s',
    icon: Shield,
    prerequisites: [],
    verifies: ['nginx.verified'],
    command: `#!/bin/bash
echo "=== Nginx Runtime Verification ==="
echo ""

INSTALLED=false
RUNNING=false
VERSION="unknown"
HTTPS_READY=false
ERROR=""

# Check if nginx is installed
if command -v nginx &>/dev/null; then
  INSTALLED=true
  VERSION=$(nginx -v 2>&1 | grep -oP 'nginx/\\K[0-9.]+' || echo "unknown")
  echo "✓ Nginx installed: $VERSION"
else
  ERROR="Nginx not found in PATH"
  echo "✗ Nginx not installed"
fi

# Check if nginx is running
if [ "$INSTALLED" = "true" ]; then
  if systemctl is-active --quiet nginx 2>/dev/null; then
    RUNNING=true
    echo "✓ Nginx service is running"
  elif pgrep -x nginx >/dev/null 2>&1; then
    RUNNING=true
    echo "✓ Nginx process is running"
  else
    ERROR="Nginx is installed but not running"
    echo "✗ Nginx is not running"
  fi
fi

# Check if certbot is available
CERTBOT_VERSION="not_installed"
if command -v certbot &>/dev/null; then
  CERTBOT_VERSION=$(certbot --version 2>&1 | grep -oP '[0-9]+\\.[0-9.]+' || echo "unknown")
  echo "✓ Certbot installed: $CERTBOT_VERSION"
fi

# Check if any HTTPS certificates exist
if [ "$RUNNING" = "true" ]; then
  if ls /etc/letsencrypt/live/*/fullchain.pem 1>/dev/null 2>&1; then
    HTTPS_READY=true
    CERT_COUNT=$(ls -d /etc/letsencrypt/live/*/ 2>/dev/null | wc -l)
    echo "✓ HTTPS ready: $CERT_COUNT certificate(s) found"
  else
    echo "○ No Let's Encrypt certificates yet"
  fi
fi

# Check listening ports
echo ""
echo "Listening ports:"
ss -tlnp 2>/dev/null | grep nginx | head -5 || echo "  No nginx ports detected"

# Output structured JSON
echo ""
cat <<EOF
{
  "service": "nginx",
  "installed": $INSTALLED,
  "running": $RUNNING,
  "version": "$VERSION",
  "certbot_version": "$CERTBOT_VERSION",
  "https_ready": $HTTPS_READY,
  "checked_at": "$(date -Iseconds)",
  "error": $([ -n "$ERROR" ] && echo "\\"$ERROR\\"" || echo "null")
}
EOF
`,
  },

  // ============================================================================
  // ADD ROUTE (Domain with HTTPS)
  // ============================================================================
  {
    id: 'proxy.nginx.add_route',
    group: 'proxy',
    name: 'Ajouter route Nginx + HTTPS',
    description: 'Configure un reverse proxy avec certificat Let\'s Encrypt',
    level: 'simple',
    risk: 'medium',
    duration: '~30s',
    icon: Globe,
    prerequisites: [
      { capability: 'nginx.installed', label: 'Nginx', required: true },
      { capability: 'certbot.installed', label: 'Certbot', required: true }
    ],
    verifies: [],
    command: `#!/bin/bash
# PARAMS: DOMAIN, BACKEND_HOST, BACKEND_PORT, BACKEND_PROTOCOL
# Usage: This playbook expects environment variables or will be called with substitutions

set -e

DOMAIN="\${DOMAIN:-example.com}"
BACKEND_HOST="\${BACKEND_HOST:-127.0.0.1}"
BACKEND_PORT="\${BACKEND_PORT:-8000}"
BACKEND_PROTOCOL="\${BACKEND_PROTOCOL:-http}"

echo "=== Configuring Nginx Route ==="
echo "Domain: $DOMAIN"
echo "Backend: $BACKEND_PROTOCOL://$BACKEND_HOST:$BACKEND_PORT"
echo ""

SITE_AVAILABLE="/etc/nginx/sites-available/$DOMAIN"
SITE_ENABLED="/etc/nginx/sites-enabled/$DOMAIN"

# Create Nginx config (initially HTTP only for ACME challenge)
cat > "$SITE_AVAILABLE" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        proxy_pass $BACKEND_PROTOCOL://$BACKEND_HOST:$BACKEND_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \\$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \\$host;
        proxy_set_header X-Real-IP \\$remote_addr;
        proxy_set_header X-Forwarded-For \\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\$scheme;
        proxy_cache_bypass \\$http_upgrade;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}
EOF

# Enable the site
ln -sf "$SITE_AVAILABLE" "$SITE_ENABLED"

# Test and reload Nginx
nginx -t
systemctl reload nginx

echo "✓ HTTP configuration applied"
echo ""

# Now obtain SSL certificate
echo "Obtaining Let's Encrypt certificate..."
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect

if [ $? -eq 0 ]; then
  echo ""
  echo "✓ HTTPS certificate obtained and configured"
  
  # Verify certificate
  if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    EXPIRY=$(openssl x509 -enddate -noout -in "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" | cut -d= -f2)
    echo "  Certificate expires: $EXPIRY"
  fi
  
  # Output success JSON
  cat <<EOF
{
  "success": true,
  "domain": "$DOMAIN",
  "backend": "$BACKEND_PROTOCOL://$BACKEND_HOST:$BACKEND_PORT",
  "https_enabled": true,
  "configured_at": "$(date -Iseconds)"
}
EOF
else
  echo "✗ Failed to obtain certificate"
  echo "  The HTTP route is still active, but without HTTPS"
  
  cat <<EOF
{
  "success": false,
  "domain": "$DOMAIN",
  "backend": "$BACKEND_PROTOCOL://$BACKEND_HOST:$BACKEND_PORT",
  "https_enabled": false,
  "error": "Certificate provisioning failed",
  "configured_at": "$(date -Iseconds)"
}
EOF
  exit 1
fi
`,
  },

  // ============================================================================
  // REMOVE ROUTE
  // ============================================================================
  {
    id: 'proxy.nginx.remove_route',
    group: 'proxy',
    name: 'Supprimer route Nginx',
    description: 'Supprime une configuration de domaine et son certificat',
    level: 'simple',
    risk: 'medium',
    duration: '~10s',
    icon: Trash2,
    prerequisites: [
      { capability: 'nginx.installed', label: 'Nginx', required: true }
    ],
    verifies: [],
    command: `#!/bin/bash
# PARAMS: DOMAIN
set -e

DOMAIN="\${DOMAIN:-example.com}"

echo "=== Removing Nginx Route ==="
echo "Domain: $DOMAIN"
echo ""

SITE_AVAILABLE="/etc/nginx/sites-available/$DOMAIN"
SITE_ENABLED="/etc/nginx/sites-enabled/$DOMAIN"

# Remove site configuration
if [ -f "$SITE_ENABLED" ]; then
  rm -f "$SITE_ENABLED"
  echo "✓ Removed from sites-enabled"
fi

if [ -f "$SITE_AVAILABLE" ]; then
  rm -f "$SITE_AVAILABLE"
  echo "✓ Removed from sites-available"
fi

# Revoke and delete certificate
if [ -d "/etc/letsencrypt/live/$DOMAIN" ]; then
  echo "Revoking certificate..."
  certbot revoke --cert-name "$DOMAIN" --delete-after-revoke --non-interactive 2>/dev/null || true
  echo "✓ Certificate revoked"
fi

# Reload Nginx
nginx -t && systemctl reload nginx

echo ""
echo "✓ Route removed successfully"

cat <<EOF
{
  "success": true,
  "domain": "$DOMAIN",
  "removed_at": "$(date -Iseconds)"
}
EOF
`,
  },

  // ============================================================================
  // LIST ROUTES
  // ============================================================================
  {
    id: 'proxy.nginx.list_routes',
    group: 'proxy',
    name: 'Lister routes Nginx',
    description: 'Affiche tous les sites configurés avec leur état HTTPS',
    level: 'simple',
    risk: 'low',
    duration: '~5s',
    icon: Globe,
    prerequisites: [
      { capability: 'nginx.installed', label: 'Nginx', required: true }
    ],
    verifies: [],
    command: `#!/bin/bash
echo "=== Nginx Routes ==="
echo ""

SITES_DIR="/etc/nginx/sites-enabled"

if [ ! -d "$SITES_DIR" ]; then
  echo "No sites-enabled directory found"
  exit 0
fi

echo "Enabled sites:"
for site in "$SITES_DIR"/*; do
  if [ -f "$site" ]; then
    SITE_NAME=$(basename "$site")
    
    # Check for SSL
    if grep -q "ssl_certificate" "$site" 2>/dev/null; then
      HTTPS="✓ HTTPS"
    else
      HTTPS="○ HTTP only"
    fi
    
    # Extract server_name
    SERVER_NAME=$(grep -m1 "server_name" "$site" 2>/dev/null | awk '{print $2}' | tr -d ';')
    
    # Extract proxy_pass
    BACKEND=$(grep -m1 "proxy_pass" "$site" 2>/dev/null | awk '{print $2}' | tr -d ';')
    
    echo "  • $SERVER_NAME -> $BACKEND [$HTTPS]"
  fi
done

echo ""
echo "Certificate status:"
certbot certificates 2>/dev/null | grep -E "(Certificate Name|Domains|Expiry)" | head -20 || echo "  No certificates found"
`,
  },

  // ============================================================================
  // RENEW CERTIFICATES
  // ============================================================================
  {
    id: 'proxy.nginx.renew_certs',
    group: 'proxy',
    name: 'Renouveler certificats',
    description: 'Force le renouvellement de tous les certificats Let\'s Encrypt',
    level: 'simple',
    risk: 'low',
    duration: '~30s',
    icon: RefreshCw,
    prerequisites: [
      { capability: 'nginx.installed', label: 'Nginx', required: true },
      { capability: 'certbot.installed', label: 'Certbot', required: true }
    ],
    verifies: [],
    command: `#!/bin/bash
echo "=== Renewing Let's Encrypt Certificates ==="
echo ""

# Dry run first
echo "Testing renewal..."
certbot renew --dry-run

if [ $? -eq 0 ]; then
  echo ""
  echo "Dry run successful, proceeding with renewal..."
  certbot renew --force-renewal
  
  echo ""
  echo "✓ Renewal complete"
  
  # Show updated certificates
  echo ""
  echo "Current certificates:"
  certbot certificates 2>/dev/null | grep -E "(Certificate Name|Expiry)" | head -10
else
  echo "✗ Dry run failed, check configuration"
  exit 1
fi
`,
  },

  // ============================================================================
  // STATUS
  // ============================================================================
  {
    id: 'proxy.nginx.status',
    group: 'proxy',
    name: 'Status Nginx',
    description: 'Affiche l\'état détaillé de Nginx et des certificats',
    level: 'simple',
    risk: 'low',
    duration: '~5s',
    icon: Shield,
    prerequisites: [],
    verifies: [],
    command: `#!/bin/bash
echo "=== Nginx Status ==="
echo ""

# Service status
echo "Service:"
systemctl status nginx --no-pager -l 2>/dev/null | head -10 || echo "  Service not found"

echo ""
echo "Version:"
nginx -v 2>&1

echo ""
echo "Configuration test:"
nginx -t 2>&1

echo ""
echo "Listening ports:"
ss -tlnp | grep nginx | head -10

echo ""
echo "Active connections:"
ss -s | head -5

echo ""
echo "Certbot status:"
certbot --version 2>&1 || echo "Certbot not installed"

echo ""
echo "Certificates:"
certbot certificates 2>/dev/null | head -20 || echo "No certificates"
`,
  },

  // ============================================================================
  // UNINSTALL
  // ============================================================================
  {
    id: 'proxy.nginx.uninstall',
    group: 'proxy',
    name: 'Désinstaller Nginx',
    description: 'Supprime Nginx et Certbot du système',
    level: 'expert',
    risk: 'high',
    duration: '~1min',
    icon: Trash2,
    prerequisites: [],
    verifies: [],
    command: `#!/bin/bash
echo "=== Uninstalling Nginx + Certbot ==="
echo ""

read -p "Are you sure you want to uninstall Nginx and all certificates? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Aborted."
  exit 0
fi

# Stop services
systemctl stop nginx 2>/dev/null || true
systemctl disable nginx 2>/dev/null || true

# Remove packages
if command -v apt-get &>/dev/null; then
  apt-get remove -y nginx certbot python3-certbot-nginx
  apt-get autoremove -y
elif command -v dnf &>/dev/null; then
  dnf remove -y nginx certbot python3-certbot-nginx
elif command -v yum &>/dev/null; then
  yum remove -y nginx certbot python3-certbot-nginx
fi

# Optionally remove config (keeping for safety)
echo ""
echo "Configuration files in /etc/nginx have been preserved."
echo "To fully remove: rm -rf /etc/nginx /etc/letsencrypt"

echo ""
echo "✓ Nginx and Certbot uninstalled"
`,
  },
];

// Helper to get Nginx playbook by ID
export function getNginxPlaybookById(id: string): Playbook | undefined {
  return NGINX_PLAYBOOKS.find(p => p.id === id);
}
