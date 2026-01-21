/**
 * CAPABILITY SYNC HOOK
 * 
 * Automatically synchronizes runner capabilities after successful playbook execution.
 * Extracts capabilities from order results and syncs them to the external API.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { apiServerQueryKeys } from './useApiServers';

// Capability detection patterns from stdout
const CAPABILITY_PATTERNS: Record<string, RegExp[]> = {
  'docker.installed': [
    /Docker version [\d.]+/i,
    /"docker":\s*"installed"/,
    /✓.*docker.*installed/i,
  ],
  'docker.compose.installed': [
    /Docker Compose version v?[\d.]+/i,
    /docker-compose version [\d.]+/i,
    /"docker\.compose":\s*"installed"/,
  ],
  'node.installed': [
    /node.*v?\d+\.\d+\.\d+/i,
    /"node":\s*"installed"/,
    /Node\.js.*installed/i,
  ],
  'npm.installed': [
    /npm.*\d+\.\d+\.\d+/i,
    /"npm":\s*"installed"/,
  ],
  'pm2.installed': [
    /pm2.*\d+\.\d+\.\d+/i,
    /"pm2":\s*"installed"/,
    /PM2.*installed/i,
  ],
  'git.installed': [
    /git version \d+\.\d+/i,
    /"git":\s*"installed"/,
  ],
  'caddy.installed': [
    /Caddy.*v?\d+\.\d+/i,
    /"caddy":\s*"installed"/,
    /caddy.*is running/i,
  ],
  'nginx.installed': [
    /nginx version.*\d+\.\d+/i,
    /nginx\/\d+\.\d+/i,
    /"nginx":\s*"installed"/,
  ],
  'redis.installed': [
    /Redis server v=[\d.]+/i,
    /redis-server.*\d+\.\d+/i,
    /"redis":\s*"installed"/,
  ],
  'fail2ban.installed': [
    /Fail2Ban v[\d.]+/i,
    /"fail2ban":\s*"installed"/,
  ],
  'ufw.installed': [
    /ufw.*active/i,
    /"ufw":\s*"installed"/,
  ],
  'certbot.installed': [
    /certbot \d+\.\d+/i,
    /"certbot":\s*"installed"/,
  ],
  'python.installed': [
    /Python \d+\.\d+\.\d+/i,
    /"python":\s*"installed"/,
  ],
  'supabase.installed': [
    /supabase.*running/i,
    /"supabase":\s*"installed"/,
    /kong.*running.*supabase/i,
  ],
  'prometheus.installed': [
    /prometheus.*\d+\.\d+/i,
    /"prometheus":\s*"installed"/,
  ],
  'node_exporter.installed': [
    /node_exporter.*\d+\.\d+/i,
    /"node_exporter":\s*"installed"/,
  ],
  'system.detected': [
    /"system\.detected":\s*"installed"/,
    /"system":\s*\{/,
  ],
};

// Extract capabilities from stdout using pattern matching
export function extractCapabilitiesFromOutput(stdout: string | null): Record<string, string> {
  if (!stdout) return {};
  
  const capabilities: Record<string, string> = {};
  
  for (const [capKey, patterns] of Object.entries(CAPABILITY_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(stdout)) {
        capabilities[capKey] = 'installed';
        break;
      }
    }
  }
  
  // Try to parse JSON capabilities block from stdout
  try {
    const jsonMatch = stdout.match(/\{[\s\S]*"capabilities"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.capabilities && typeof parsed.capabilities === 'object') {
        Object.assign(capabilities, parsed.capabilities);
      }
    }
  } catch {
    // Ignore JSON parse errors
  }
  
  return capabilities;
}

// Extract system info from stdout
export function extractSystemInfoFromOutput(stdout: string | null): Record<string, unknown> | null {
  if (!stdout) return null;
  
  try {
    const jsonMatch = stdout.match(/\{[\s\S]*"system"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.system && typeof parsed.system === 'object') {
        return parsed.system;
      }
    }
  } catch {
    // Ignore JSON parse errors
  }
  
  return null;
}

interface SyncCapabilitiesInput {
  runnerId: string;
  capabilities: Record<string, string>;
  merge?: boolean; // If true, merge with existing capabilities
}

/**
 * Sync capabilities to the external API via admin-proxy
 */
export function useSyncCapabilities() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ runnerId, capabilities, merge = true }: SyncCapabilitiesInput) => {
      if (Object.keys(capabilities).length === 0) {
        return { success: true, skipped: true };
      }
      
      const { data, error } = await supabase.functions.invoke('admin-proxy', {
        body: {
          method: 'PATCH',
          path: `/runners/${runnerId}/capabilities`,
          body: { capabilities, merge },
        },
      });
      
      if (error) {
        throw new Error(error.message || 'Failed to sync capabilities');
      }
      
      return data;
    },
    onSuccess: (data, variables) => {
      if (!data?.skipped) {
        // Invalidate runner queries to refresh capabilities
        queryClient.invalidateQueries({ queryKey: apiServerQueryKeys.runners });
        queryClient.invalidateQueries({ queryKey: ['proxy-runners'] });
        queryClient.invalidateQueries({ queryKey: ['proxy-runners-v2'] });
        
        console.info(`[CapabilitySync] Synced ${Object.keys(variables.capabilities).length} capabilities for runner ${variables.runnerId}`);
      }
    },
    onError: (error: Error) => {
      console.error('[CapabilitySync] Failed:', error);
      // Don't show toast for capability sync errors - it's a background operation
    },
  });
}

/**
 * Hook to auto-sync capabilities after order completion
 */
export function useAutoCapabilitySync() {
  const syncCapabilities = useSyncCapabilities();
  
  const processCompletedOrder = async (
    runnerId: string,
    orderId: string,
    status: string,
    stdoutTail: string | null,
    result: unknown
  ) => {
    // Only process completed orders
    if (status !== 'completed') {
      return;
    }
    
    // Extract capabilities from stdout
    const extractedCaps = extractCapabilitiesFromOutput(stdoutTail);
    
    // Also check result field for capabilities
    if (result && typeof result === 'object' && 'capabilities' in result) {
      const resultCaps = (result as { capabilities: Record<string, string> }).capabilities;
      if (typeof resultCaps === 'object') {
        Object.assign(extractedCaps, resultCaps);
      }
    }
    
    if (Object.keys(extractedCaps).length > 0) {
      console.info(`[AutoCapabilitySync] Order ${orderId} completed, found ${Object.keys(extractedCaps).length} capabilities`);
      
      try {
        await syncCapabilities.mutateAsync({
          runnerId,
          capabilities: extractedCaps,
          merge: true,
        });
        
        toast({
          title: 'Capacités synchronisées',
          description: `${Object.keys(extractedCaps).length} capacités détectées et synchronisées.`,
        });
      } catch (err) {
        console.error('[AutoCapabilitySync] Sync failed:', err);
      }
    }
  };
  
  return {
    processCompletedOrder,
    isSyncing: syncCapabilities.isPending,
  };
}

// The auto-discovery playbook command
export const AUTO_DISCOVERY_COMMAND = `#!/bin/bash
set -e

echo "=== IKOMA Auto-Discovery ==="
echo "Detecting installed software and capabilities..."
echo ""

# Initialize capabilities JSON
declare -A CAPS

# Function to add capability
add_cap() {
  CAPS["$1"]="$2"
  echo "✓ $1: $2"
}

# System detection
echo "--- System ---"
if [ -f /etc/os-release ]; then
  . /etc/os-release
  echo "OS: $NAME $VERSION_ID"
fi
echo "Arch: $(uname -m)"
echo "Kernel: $(uname -r)"
add_cap "system.detected" "installed"

# Docker
echo ""
echo "--- Docker ---"
if command -v docker &>/dev/null; then
  DOCKER_V=$(docker --version 2>/dev/null | grep -oP '\\d+\\.\\d+\\.\\d+' | head -1)
  add_cap "docker.installed" "installed"
  echo "Docker version: $DOCKER_V"
  
  if docker compose version &>/dev/null || docker-compose --version &>/dev/null; then
    add_cap "docker.compose.installed" "installed"
  fi
else
  echo "Docker: not installed"
fi

# Node.js
echo ""
echo "--- Node.js ---"
if command -v node &>/dev/null; then
  NODE_V=$(node --version 2>/dev/null)
  add_cap "node.installed" "installed"
  echo "Node.js version: $NODE_V"
  
  if command -v npm &>/dev/null; then
    NPM_V=$(npm --version 2>/dev/null)
    add_cap "npm.installed" "installed"
    echo "npm version: $NPM_V"
  fi
  
  if command -v pm2 &>/dev/null; then
    add_cap "pm2.installed" "installed"
    echo "PM2: installed"
  fi
else
  echo "Node.js: not installed"
fi

# Git
echo ""
echo "--- Git ---"
if command -v git &>/dev/null; then
  GIT_V=$(git --version 2>/dev/null | grep -oP '\\d+\\.\\d+\\.\\d+')
  add_cap "git.installed" "installed"
  echo "Git version: $GIT_V"
else
  echo "Git: not installed"
fi

# Python
echo ""
echo "--- Python ---"
if command -v python3 &>/dev/null; then
  PY_V=$(python3 --version 2>/dev/null)
  add_cap "python.installed" "installed"
  echo "Python: $PY_V"
elif command -v python &>/dev/null; then
  PY_V=$(python --version 2>/dev/null)
  add_cap "python.installed" "installed"
  echo "Python: $PY_V"
else
  echo "Python: not installed"
fi

# Web Servers / Proxies
echo ""
echo "--- Web Servers ---"
if command -v caddy &>/dev/null; then
  add_cap "caddy.installed" "installed"
  echo "Caddy: installed"
fi

if command -v nginx &>/dev/null; then
  add_cap "nginx.installed" "installed"
  echo "Nginx: installed"
fi

if command -v certbot &>/dev/null; then
  add_cap "certbot.installed" "installed"
  echo "Certbot: installed"
fi

# Databases
echo ""
echo "--- Databases ---"
if command -v redis-cli &>/dev/null || docker ps 2>/dev/null | grep -q redis; then
  add_cap "redis.installed" "installed"
  echo "Redis: installed"
fi

if docker ps 2>/dev/null | grep -q supabase; then
  add_cap "supabase.installed" "installed"
  echo "Supabase: running"
fi

# Security
echo ""
echo "--- Security ---"
if command -v fail2ban-client &>/dev/null; then
  add_cap "fail2ban.installed" "installed"
  echo "Fail2ban: installed"
fi

if command -v ufw &>/dev/null; then
  UFW_STATUS=$(ufw status 2>/dev/null | head -1)
  if echo "$UFW_STATUS" | grep -q "active"; then
    add_cap "ufw.installed" "installed"
    echo "UFW: active"
  else
    echo "UFW: installed but inactive"
  fi
fi

# Monitoring
echo ""
echo "--- Monitoring ---"
if systemctl is-active node_exporter &>/dev/null || pgrep -x node_exporter &>/dev/null; then
  add_cap "node_exporter.installed" "installed"
  echo "Node Exporter: running"
fi

if docker ps 2>/dev/null | grep -q prometheus; then
  add_cap "prometheus.installed" "installed"
  echo "Prometheus: running"
fi

# Output JSON for capability extraction
echo ""
echo "=== Capabilities JSON ==="
echo "{"
echo '  "capabilities": {'
FIRST=1
for key in "\${!CAPS[@]}"; do
  if [ $FIRST -eq 1 ]; then
    FIRST=0
  else
    echo ","
  fi
  printf '    "%s": "%s"' "$key" "\${CAPS[$key]}"
done
echo ""
echo "  }"
echo "}"

echo ""
echo "=== Discovery Complete ==="
`;
