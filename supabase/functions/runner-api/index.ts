import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-runner-token',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const url = new URL(req.url)
  const path = url.pathname.replace('/functions/v1/runner-api', '')

  try {
    // GET /health - Public health check
    if (req.method === 'GET' && path === '/health') {
      return new Response(
        JSON.stringify({ 
          status: 'ok', 
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client with service role for runner operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // POST /register - Runner registration
    if (req.method === 'POST' && path === '/register') {
      const body = await req.json()
      const { name, token, host_info, capabilities } = body

      if (!name || !token) {
        return new Response(
          JSON.stringify({ error: 'name and token are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Hash the token for storage
      const encoder = new TextEncoder()
      const data = encoder.encode(token)
      const hashBuffer = await crypto.subtle.digest('SHA-256', data)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const tokenHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

      // Check if runner with same name exists
      const { data: existing } = await supabase
        .from('runners')
        .select('id')
        .eq('name', name)
        .maybeSingle()

      if (existing) {
        // Update existing runner
        const { data: runner, error } = await supabase
          .from('runners')
          .update({
            token_hash: tokenHash,
            status: 'online',
            host_info: host_info || {},
            capabilities: capabilities || {},
            last_seen_at: new Date().toISOString()
          })
          .eq('id', existing.id)
          .select()
          .single()

        if (error) throw error

        return new Response(
          JSON.stringify({ success: true, runner_id: runner.id, message: 'Runner updated' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Create new runner
      const { data: runner, error } = await supabase
        .from('runners')
        .insert({
          name,
          token_hash: tokenHash,
          status: 'online',
          host_info: host_info || {},
          capabilities: capabilities || {},
          last_seen_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) throw error

      return new Response(
        JSON.stringify({ success: true, runner_id: runner.id, message: 'Runner registered' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // POST /heartbeat - Runner heartbeat
    if (req.method === 'POST' && path === '/heartbeat') {
      const runnerToken = req.headers.get('x-runner-token')
      if (!runnerToken) {
        return new Response(
          JSON.stringify({ error: 'x-runner-token header required' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Hash the token to find the runner
      const encoder = new TextEncoder()
      const data = encoder.encode(runnerToken)
      const hashBuffer = await crypto.subtle.digest('SHA-256', data)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const tokenHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

      const { data: runner, error: findError } = await supabase
        .from('runners')
        .select('id, status')
        .eq('token_hash', tokenHash)
        .maybeSingle()

      if (!runner) {
        return new Response(
          JSON.stringify({ error: 'Runner not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Update last_seen_at and status
      const { error } = await supabase
        .from('runners')
        .update({
          last_seen_at: new Date().toISOString(),
          status: runner.status === 'paused' ? 'paused' : 'online'
        })
        .eq('id', runner.id)

      if (error) throw error

      return new Response(
        JSON.stringify({ success: true, timestamp: new Date().toISOString() }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // GET /orders/poll - Poll for pending orders (stub)
    if (req.method === 'GET' && path === '/orders/poll') {
      const runnerToken = req.headers.get('x-runner-token')
      if (!runnerToken) {
        return new Response(
          JSON.stringify({ error: 'x-runner-token header required' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Verify runner exists
      const encoder = new TextEncoder()
      const data = encoder.encode(runnerToken)
      const hashBuffer = await crypto.subtle.digest('SHA-256', data)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const tokenHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

      const { data: runner } = await supabase
        .from('runners')
        .select('id')
        .eq('token_hash', tokenHash)
        .maybeSingle()

      if (!runner) {
        return new Response(
          JSON.stringify({ error: 'Runner not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Return empty orders for now (stub)
      return new Response(
        JSON.stringify({ orders: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // POST /orders/report - Report order execution (stub)
    if (req.method === 'POST' && path === '/orders/report') {
      const runnerToken = req.headers.get('x-runner-token')
      if (!runnerToken) {
        return new Response(
          JSON.stringify({ error: 'x-runner-token header required' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Just acknowledge for now
      return new Response(
        JSON.stringify({ success: true, message: 'Report received' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 404 for unknown routes
    return new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    console.error('Runner API error:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})