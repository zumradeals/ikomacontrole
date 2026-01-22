import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const baseUrl = Deno.env.get('AUTOMATE_BASE_URL') || 'https://api.ikomadigit.com';
    const adminKey = Deno.env.get('IKOMA_ADMIN_KEY');

    // Validate admin key is configured
    if (!adminKey) {
      console.error('IKOMA_ADMIN_KEY not configured in secrets');
      return new Response(
        JSON.stringify({ error: 'Server configuration error: Admin key not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Parse body for method/path/body format
    const { method, path, body } = await req.json();
    
    if (!path) {
      return new Response(
        JSON.stringify({ error: 'Path is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Security: Block any direct access to runners by ID if requested via path
    if (path.match(/^\/runners\/[^/]+$/) && (method === 'GET')) {
      return new Response(
        JSON.stringify({ error: 'GET /runners/:id is not supported. Use GET /runners and filter locally.' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const targetUrl = `${baseUrl}/v1${path}`;
    const httpMethod = method || 'GET';
    console.info(`Proxying ${httpMethod} ${targetUrl}`);

    // Build headers - only include Content-Type for requests with body
    const headers: Record<string, string> = {
      'x-ikoma-admin-key': adminKey,
    };

    const fetchOptions: RequestInit = {
      method: httpMethod,
      headers,
    };

    // Add body for POST/PUT/PATCH requests
    if (body && ['POST', 'PUT', 'PATCH'].includes(httpMethod)) {
      headers['Content-Type'] = 'application/json';
      fetchOptions.body = JSON.stringify(body);
    } else if (['POST', 'PUT', 'PATCH'].includes(httpMethod)) {
      // Send empty object for POST/PUT/PATCH without body
      headers['Content-Type'] = 'application/json';
      fetchOptions.body = JSON.stringify({});
    }
    // DELETE requests: no Content-Type header, no body

    // Special handling for /playbooks - return mock data if API doesn't have endpoint yet
    // Once API GET /v1/playbooks is ready, remove this block and let proxy forward
    if (path === '/playbooks' && httpMethod === 'GET') {
      // TODO: Remove this mock when API endpoint GET /v1/playbooks is ready
      const playbooks = {
        items: [
          {
            key: 'SYSTEM.diagnostics',
            version: 'v1',
            title: 'System diagnostics',
            description: 'Inspection complète du système: OS, ressources, services',
            visibility: 'internal',
            actions: ['run'],
            schema: {
              type: 'object',
              properties: {
                serverId: { type: 'string', description: 'ID du serveur cible' }
              },
              required: ['serverId']
            }
          },
          {
            key: 'SYSTEM.heartbeat',
            version: 'v1',
            title: 'Heartbeat Check',
            description: 'Test de connectivité rapide avec le runner',
            visibility: 'internal',
            actions: ['run'],
            schema: {
              type: 'object',
              properties: {
                serverId: { type: 'string' }
              },
              required: ['serverId']
            }
          },
          {
            key: 'system.test_ping',
            version: 'v1',
            title: 'Test de connectivité',
            description: 'Vérifie que le runner peut exécuter une commande',
            visibility: 'internal',
            actions: ['run'],
            schema: {
              type: 'object',
              properties: {
                serverId: { type: 'string' }
              },
              required: ['serverId']
            }
          },
          {
            key: 'system.autodiscover',
            version: 'v1',
            title: 'Auto-découverte',
            description: 'Détecte automatiquement tous les logiciels installés',
            visibility: 'internal',
            actions: ['run'],
            schema: {
              type: 'object',
              properties: {
                serverId: { type: 'string' }
              },
              required: ['serverId']
            }
          },
          {
            key: 'system.info',
            version: 'v1',
            title: 'Informations système',
            description: 'Collecte OS, distribution, architecture, CPU, RAM, disque',
            visibility: 'internal',
            actions: ['run'],
            schema: {
              type: 'object',
              properties: {
                serverId: { type: 'string' }
              },
              required: ['serverId']
            }
          },
          {
            key: 'docker.install',
            version: 'v1',
            title: 'Installer Docker',
            description: 'Installe Docker Engine et Docker Compose',
            visibility: 'internal',
            actions: ['run'],
            schema: {
              type: 'object',
              properties: {
                serverId: { type: 'string' }
              },
              required: ['serverId']
            }
          },
          {
            key: 'docker.verify',
            version: 'v1',
            title: 'Vérifier Docker',
            description: 'Vérifie l\'installation et le statut Docker',
            visibility: 'internal',
            actions: ['run'],
            schema: {
              type: 'object',
              properties: {
                serverId: { type: 'string' }
              },
              required: ['serverId']
            }
          },
          {
            key: 'caddy.install',
            version: 'v1',
            title: 'Installer Caddy',
            description: 'Installe Caddy comme reverse proxy avec HTTPS auto',
            visibility: 'internal',
            actions: ['run'],
            schema: {
              type: 'object',
              properties: {
                serverId: { type: 'string' }
              },
              required: ['serverId']
            }
          },
          {
            key: 'caddy.verify',
            version: 'v1',
            title: 'Vérifier Caddy',
            description: 'Vérifie l\'installation et le statut Caddy',
            visibility: 'internal',
            actions: ['run'],
            schema: {
              type: 'object',
              properties: {
                serverId: { type: 'string' }
              },
              required: ['serverId']
            }
          },
          {
            key: 'nodejs.install',
            version: 'v1',
            title: 'Installer Node.js',
            description: 'Installe Node.js LTS via nvm',
            visibility: 'internal',
            actions: ['run'],
            schema: {
              type: 'object',
              properties: {
                serverId: { type: 'string' },
                version: { type: 'string', description: 'Version Node.js (default: lts)' }
              },
              required: ['serverId']
            }
          },
          {
            key: 'security.ufw.setup',
            version: 'v1',
            title: 'Configurer UFW',
            description: 'Configure le firewall UFW avec règles de base',
            visibility: 'internal',
            actions: ['run'],
            schema: {
              type: 'object',
              properties: {
                serverId: { type: 'string' }
              },
              required: ['serverId']
            }
          },
          {
            key: 'security.fail2ban.install',
            version: 'v1',
            title: 'Installer Fail2ban',
            description: 'Installe et configure Fail2ban',
            visibility: 'internal',
            actions: ['run'],
            schema: {
              type: 'object',
              properties: {
                serverId: { type: 'string' }
              },
              required: ['serverId']
            }
          }
        ]
      };

      console.info('Returning playbook catalog (mock data)');
      return new Response(
        JSON.stringify(playbooks),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const startTime = Date.now();
    const response = await fetch(targetUrl, fetchOptions);
    const duration = Date.now() - startTime;
    
    let responseData;
    const contentType = response.headers.get('content-type');
    
    if (contentType?.includes('application/json')) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }

    console.info(`Proxy response status: ${response.status} (${duration}ms)`);

    // Prepare base response with proxy diagnostic info
    const baseResponse = {
      proxy_target: targetUrl,
      proxy_status: response.status,
      proxy_duration: duration,
    };

    // Handle non-2xx responses
    if (!response.ok) {
      console.error(`API error: ${response.status}`, responseData);
      return new Response(
        JSON.stringify({ 
          ...baseResponse,
          error: responseData?.message || responseData?.error || `API returned ${response.status}`,
          proxy_error: responseData
        }),
        { 
          status: response.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // For GET /runners, normalize the response format
    if (path === '/runners' && httpMethod === 'GET') {
      const rawRunners = responseData?.runners || responseData;
      const runners = Array.isArray(rawRunners) 
        ? rawRunners.map((runner: Record<string, unknown>) => ({
            id: runner.id,
            name: runner.name,
            status: runner.status,
            lastHeartbeatAt: runner.last_seen_at || runner.lastHeartbeatAt || runner.last_heartbeat_at,
            infrastructureId: runner.infrastructure_id || runner.infrastructureId,
            serverId: runner.server_id || runner.serverId,
            serverName: runner.server_name || runner.serverName,
            scopes: runner.scopes,
            capabilities: runner.capabilities || {},
            hostInfo: runner.host_info || runner.hostInfo,
            createdAt: runner.created_at || runner.createdAt,
          }))
        : [];
      return new Response(
        JSON.stringify(runners),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // For PATCH /runners/:id/capabilities, handle capability updates
    if (path.match(/^\/runners\/[^/]+\/capabilities$/) && httpMethod === 'PATCH') {
      console.info('Capabilities update response:', responseData);
      return new Response(
        JSON.stringify({ 
          success: true, 
          capabilities: responseData?.capabilities || responseData,
          ...baseResponse 
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // For GET /servers, normalize the response format
    if (path === '/servers' && httpMethod === 'GET') {
      const rawServers = responseData?.servers || responseData;
      const servers = Array.isArray(rawServers) 
        ? rawServers.map((server: Record<string, unknown>) => ({
            id: server.id,
            name: server.name,
            host: server.host,
            ip: server.ip,
            baseUrl: server.base_url || server.baseUrl,
            runnerId: server.runner_id || server.runnerId || (server.runner as Record<string, unknown>)?.id,
            runnerName: (server.runner as Record<string, unknown>)?.name || server.runner_name || server.runnerName,
            runnerStatus: (server.runner as Record<string, unknown>)?.status || server.runner_status || server.runnerStatus,
            status: server.status,
            createdAt: server.created_at || server.createdAt,
            updatedAt: server.updated_at || server.updatedAt,
          }))
        : [];
      return new Response(
        JSON.stringify(servers),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Default: return the data as is but wrapped with proxy info if it's an object
    const finalData = (typeof responseData === 'object' && responseData !== null)
      ? { ...responseData, ...baseResponse }
      : responseData;

    return new Response(
      JSON.stringify(finalData),
      { 
        status: response.status, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Proxy error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
