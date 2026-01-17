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

    const targetUrl = `${baseUrl}/v1${path}`;
    const httpMethod = method || 'GET';
    console.info(`Proxying ${httpMethod} ${targetUrl}`);

    const fetchOptions: RequestInit = {
      method: httpMethod,
      headers: {
        'Content-Type': 'application/json',
        'x-ikoma-admin-key': adminKey,
      },
    };

    // Add body for POST/PUT/PATCH requests
    if (body && ['POST', 'PUT', 'PATCH'].includes(httpMethod)) {
      fetchOptions.body = JSON.stringify(body);
    } else if (['POST', 'PUT', 'PATCH'].includes(httpMethod)) {
      // Send empty object for POST/PUT/PATCH without body
      fetchOptions.body = JSON.stringify({});
    }

    const response = await fetch(targetUrl, fetchOptions);
    
    let responseData;
    const contentType = response.headers.get('content-type');
    
    if (contentType?.includes('application/json')) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }

    console.info(`Proxy response status: ${response.status}`);

    // Handle non-2xx responses - return error directly without processing
    if (!response.ok) {
      console.error(`API error: ${response.status}`, responseData);
      return new Response(
        JSON.stringify({ 
          error: responseData?.message || responseData?.error || `API returned ${response.status}`,
          status: response.status 
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
            scopes: runner.scopes,
            capabilities: runner.capabilities,
            hostInfo: runner.host_info || runner.hostInfo,
            createdAt: runner.created_at || runner.createdAt,
          }))
        : [];
      console.info(`Found ${runners.length} runners`);
      return new Response(
        JSON.stringify({ runners }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // For GET /runners/:id, normalize single runner response
    if (path.match(/^\/runners\/[^/]+$/) && httpMethod === 'GET') {
      const runner = responseData?.runner || responseData;
      if (runner && typeof runner === 'object') {
        const normalizedRunner = {
          id: runner.id,
          name: runner.name,
          status: runner.status,
          lastHeartbeatAt: runner.last_seen_at || runner.lastHeartbeatAt || runner.last_heartbeat_at,
          infrastructureId: runner.infrastructure_id || runner.infrastructureId,
          serverId: runner.server_id || runner.serverId,
          scopes: runner.scopes,
          capabilities: runner.capabilities,
          hostInfo: runner.host_info || runner.hostInfo,
          createdAt: runner.created_at || runner.createdAt,
        };
        return new Response(
          JSON.stringify(normalizedRunner),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }

    // For PATCH /runners/:id, return the updated runner or success
    if (path.match(/^\/runners\/[^/]+$/) && httpMethod === 'PATCH') {
      console.info('PATCH runner response:', responseData);
      return new Response(
        JSON.stringify(responseData || { success: true }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // For DELETE /runners/:id
    if (path.match(/^\/runners\/[^/]+$/) && httpMethod === 'DELETE') {
      console.info('DELETE runner response:', responseData);
      return new Response(
        JSON.stringify(responseData || { success: true }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    return new Response(
      JSON.stringify(responseData),
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
