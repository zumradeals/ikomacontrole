import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const AUTOMATE_BASE_URL = Deno.env.get('AUTOMATE_BASE_URL') || 'https://automate.ikomadigit.com';
const IKOMA_ADMIN_KEY = Deno.env.get('IKOMA_ADMIN_KEY');

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace('/admin-proxy', '');

    // Validate admin key is configured
    if (!IKOMA_ADMIN_KEY) {
      console.error('IKOMA_ADMIN_KEY not configured in secrets');
      return new Response(
        JSON.stringify({ error: 'Server configuration error: Admin key not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Route: GET /runners - List all runners
    if (path === '/runners' && req.method === 'GET') {
      console.log('Proxying GET /v1/runners');
      
      const response = await fetch(`${AUTOMATE_BASE_URL}/v1/runners`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-ikoma-admin-key': IKOMA_ADMIN_KEY,
        },
      });

      const data = await response.json();
      
      // Filter out sensitive data (tokenHash) and return only needed fields
      const runners = (data.runners || data || []).map((runner: any) => ({
        id: runner.id,
        name: runner.name,
        status: runner.status,
        lastHeartbeatAt: runner.last_seen_at || runner.lastHeartbeatAt,
        infrastructureId: runner.infrastructure_id || runner.infrastructureId,
        scopes: runner.scopes,
        capabilities: runner.capabilities,
        hostInfo: runner.host_info || runner.hostInfo,
        createdAt: runner.created_at || runner.createdAt,
      }));

      console.log(`Found ${runners.length} runners`);
      
      return new Response(
        JSON.stringify({ runners }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Route: POST /runners - Create a new runner
    if (path === '/runners' && req.method === 'POST') {
      const body = await req.json();
      const { name, infrastructureId } = body;

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return new Response(
          JSON.stringify({ error: 'Runner name is required' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      console.log(`Proxying POST /v1/runners - Creating runner: ${name}`);
      
      const response = await fetch(`${AUTOMATE_BASE_URL}/v1/runners`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ikoma-admin-key': IKOMA_ADMIN_KEY,
        },
        body: JSON.stringify({
          name: name.trim(),
          infrastructure_id: infrastructureId || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Create runner failed:', errorData);
        return new Response(
          JSON.stringify({ error: errorData.message || `HTTP ${response.status}` }),
          { 
            status: response.status, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      const data = await response.json();
      console.log(`Runner created: ${data.id}`);
      
      // Return id, name, and clear token (visible only once)
      return new Response(
        JSON.stringify({
          id: data.id,
          name: data.name,
          token: data.token, // Clear token from backend
        }),
        { 
          status: 201, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Route: POST /runners/:id/token/reset - Reset runner token
    const tokenResetMatch = path.match(/^\/runners\/([a-f0-9-]+)\/token\/reset$/);
    if (tokenResetMatch && req.method === 'POST') {
      const runnerId = tokenResetMatch[1];
      
      console.log(`Proxying POST /v1/runners/${runnerId}/token/reset`);
      
      const response = await fetch(`${AUTOMATE_BASE_URL}/v1/runners/${runnerId}/token/reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ikoma-admin-key': IKOMA_ADMIN_KEY,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Token reset failed:', errorData);
        return new Response(
          JSON.stringify({ error: errorData.message || `HTTP ${response.status}` }),
          { 
            status: response.status, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      const data = await response.json();
      console.log(`Token reset for runner: ${runnerId}`);
      
      return new Response(
        JSON.stringify({
          token: data.token, // Clear token from backend
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Unknown route
    console.warn(`Unknown route: ${req.method} ${path}`);
    return new Response(
      JSON.stringify({ error: 'Not found', path, method: req.method }),
      { 
        status: 404, 
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
