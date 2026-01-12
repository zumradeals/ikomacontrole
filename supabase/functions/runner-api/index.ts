import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-runner-token',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

// === CONSTANTS ===
const RUNNER_VERSION = '2.1.0'
const HEARTBEAT_INTERVAL_SECONDS = 30
const POLL_INTERVAL_SECONDS = 5
const RUNNER_OFFLINE_THRESHOLD_SECONDS = 60
const ORDER_TIMEOUT_MINUTES = 15

// === HELPERS ===

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(token)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

async function getRunnerByToken(supabase: any, token: string) {
  const tokenHash = await hashToken(token)
  const { data: runner } = await supabase
    .from('runners')
    .select('id, status, name, infrastructure_id')
    .eq('token_hash', tokenHash)
    .maybeSingle()
  return runner
}

// Determine final order status based on exit_code (source of truth)
function determineOrderStatus(exitCode: number | null, reportedStatus: string): 'running' | 'completed' | 'failed' {
  if (reportedStatus === 'running') return 'running'
  if (exitCode === 0) return 'completed'
  if (exitCode !== null && exitCode !== 0) return 'failed'
  if (reportedStatus === 'completed' || reportedStatus === 'applied') return 'completed'
  if (reportedStatus === 'failed') return 'failed'
  return 'failed'
}

// Extract capabilities from stdout
function extractCapabilitiesFromStdout(stdout: string): Record<string, string> | null {
  if (!stdout) return null
  const lines = stdout.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('{') && trimmed.includes('"capabilities"')) {
      try {
        const parsed = JSON.parse(trimmed)
        if (parsed.capabilities && typeof parsed.capabilities === 'object') {
          return parsed.capabilities as Record<string, string>
        }
      } catch { continue }
    }
  }
  return null
}

// Extract system info from stdout
function extractSystemInfoFromStdout(stdout: string): Record<string, unknown> | null {
  if (!stdout) return null
  const lines = stdout.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('{') && (trimmed.includes('"system"') || trimmed.includes('"os"') || trimmed.includes('"provider"'))) {
      try {
        const parsed = JSON.parse(trimmed)
        if (parsed.system && typeof parsed.system === 'object') {
          return parsed.system as Record<string, unknown>
        }
        if (parsed.os || parsed.architecture || parsed.provider || parsed.cpu_cores) {
          return parsed as Record<string, unknown>
        }
      } catch { continue }
    }
  }
  return null
}

// === MAIN HANDLER ===

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const url = new URL(req.url)
  const pathname = url.pathname
  
  console.log('Incoming request:', req.method, pathname)
  
  // Normalize path
  let path = pathname
  if (path.includes('/runner-api')) {
    const idx = path.indexOf('/runner-api')
    path = path.substring(idx + '/runner-api'.length)
  }
  if (!path || path === '') path = '/'
  else if (!path.startsWith('/')) path = '/' + path
  
  console.log('Normalized path:', path)

  try {
    // === PUBLIC ENDPOINTS (no auth) ===
    
    // GET /health
    if (req.method === 'GET' && path === '/health') {
      return new Response(
        JSON.stringify({ 
          status: 'ok', 
          timestamp: new Date().toISOString(),
          version: RUNNER_VERSION,
          heartbeat_interval: HEARTBEAT_INTERVAL_SECONDS,
          poll_interval: POLL_INTERVAL_SECONDS,
          offline_threshold: RUNNER_OFFLINE_THRESHOLD_SECONDS
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // GET /install-runner.sh
    if (req.method === 'GET' && path === '/install-runner.sh') {
      return new Response(generateInstallScript(), { 
        headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' } 
      })
    }

    // GET /uninstall-runner.sh
    if (req.method === 'GET' && path === '/uninstall-runner.sh') {
      return new Response(generateUninstallScript(), { 
        headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' } 
      })
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // === DASHBOARD ENDPOINTS ===

    // GET /stats - Dashboard statistics
    if (req.method === 'GET' && path === '/stats') {
      return await handleStats(supabase)
    }

    // POST /timeout-check - Check and timeout stale orders
    if (req.method === 'POST' && path === '/timeout-check') {
      return await handleTimeoutCheck(supabase)
    }

    // === RUNNER AUTHENTICATED ENDPOINTS ===

    // POST /register
    if (req.method === 'POST' && path === '/register') {
      return await handleRegister(req, supabase)
    }

    // POST /heartbeat
    if (req.method === 'POST' && path === '/heartbeat') {
      return await handleHeartbeat(req, supabase)
    }

    // GET /orders/poll
    if (req.method === 'GET' && path === '/orders/poll') {
      return await handleOrdersPoll(req, supabase)
    }

    // POST /orders/claim - Atomic claim of a single order
    if (req.method === 'POST' && path === '/orders/claim') {
      return await handleOrdersClaim(req, supabase)
    }

    // POST /orders/report
    if (req.method === 'POST' && path === '/orders/report') {
      return await handleOrdersReport(req, supabase)
    }

    // 404
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

// === HANDLERS ===

async function handleStats(supabase: any): Promise<Response> {
  const now = new Date()
  const offlineThreshold = new Date(now.getTime() - RUNNER_OFFLINE_THRESHOLD_SECONDS * 1000).toISOString()
  
  // Count online runners (based on last_seen_at)
  const { count: onlineRunners } = await supabase
    .from('runners')
    .select('id', { count: 'exact', head: true })
    .gte('last_seen_at', offlineThreshold)

  // Count total runners
  const { count: totalRunners } = await supabase
    .from('runners')
    .select('id', { count: 'exact', head: true })

  // Count pending orders
  const { count: pendingOrders } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')

  // Count running orders
  const { count: runningOrders } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'running')

  // Count completed orders in last 24h
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const { count: completedLast24h } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'completed')
    .gte('completed_at', last24h)

  // Count failed orders in last 24h
  const { count: failedLast24h } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'failed')
    .gte('completed_at', last24h)

  return new Response(
    JSON.stringify({
      success: true,
      stats: {
        runners: {
          online: onlineRunners || 0,
          total: totalRunners || 0,
          offline: (totalRunners || 0) - (onlineRunners || 0)
        },
        orders: {
          pending: pendingOrders || 0,
          running: runningOrders || 0,
          queue: (pendingOrders || 0) + (runningOrders || 0),
          completed_24h: completedLast24h || 0,
          failed_24h: failedLast24h || 0
        },
        timestamp: now.toISOString()
      }
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function handleTimeoutCheck(supabase: any): Promise<Response> {
  const now = new Date()
  const timeoutThreshold = new Date(now.getTime() - ORDER_TIMEOUT_MINUTES * 60 * 1000).toISOString()
  
  // Find running orders that started more than TIMEOUT_MINUTES ago
  const { data: staleOrders, error } = await supabase
    .from('orders')
    .select('id, name, runner_id, started_at')
    .eq('status', 'running')
    .lt('started_at', timeoutThreshold)

  if (error) throw error

  const timedOutIds: string[] = []

  for (const order of (staleOrders || [])) {
    // Update to failed with timeout reason
    await supabase
      .from('orders')
      .update({
        status: 'failed',
        error_message: `Order timed out after ${ORDER_TIMEOUT_MINUTES} minutes without response`,
        completed_at: now.toISOString()
      })
      .eq('id', order.id)

    timedOutIds.push(order.id)

    // Log the timeout
    await supabase.from('runner_logs').insert({
      runner_id: order.runner_id,
      level: 'warn',
      event_type: 'order_timeout',
      message: `Order ${order.name} (${order.id}) timed out after ${ORDER_TIMEOUT_MINUTES} minutes`,
    })
  }

  return new Response(
    JSON.stringify({
      success: true,
      timed_out_count: timedOutIds.length,
      timed_out_orders: timedOutIds
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function handleRegister(req: Request, supabase: any): Promise<Response> {
  const body = await req.json()
  const { name, token, host_info, capabilities } = body

  if (!name || !token) {
    return new Response(
      JSON.stringify({ success: false, error: 'name and token are required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const tokenHash = await hashToken(token)
  const now = new Date().toISOString()

  // Check if runner with same name exists
  const { data: existing } = await supabase
    .from('runners')
    .select('id')
    .eq('name', name)
    .maybeSingle()

  if (existing) {
    const { data: runner, error } = await supabase
      .from('runners')
      .update({
        token_hash: tokenHash,
        status: 'online',
        host_info: host_info || {},
        capabilities: capabilities || {},
        last_seen_at: now
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

  const { data: runner, error } = await supabase
    .from('runners')
    .insert({
      name,
      token_hash: tokenHash,
      status: 'online',
      host_info: host_info || {},
      capabilities: capabilities || {},
      last_seen_at: now
    })
    .select()
    .single()

  if (error) throw error

  return new Response(
    JSON.stringify({ success: true, runner_id: runner.id, message: 'Runner registered' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function handleHeartbeat(req: Request, supabase: any): Promise<Response> {
  const runnerToken = req.headers.get('x-runner-token')
  if (!runnerToken) {
    return new Response(
      JSON.stringify({ success: false, error: 'x-runner-token header required' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const runner = await getRunnerByToken(supabase, runnerToken)
  if (!runner) {
    return new Response(
      JSON.stringify({ success: false, error: 'Runner not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const now = new Date().toISOString()

  // Update last_seen_at (status derived from this)
  const { error } = await supabase
    .from('runners')
    .update({ 
      last_seen_at: now,
      status: runner.status === 'paused' ? 'paused' : 'online'
    })
    .eq('id', runner.id)

  if (error) throw error

  return new Response(
    JSON.stringify({ 
      success: true, 
      timestamp: now,
      next_heartbeat_in: HEARTBEAT_INTERVAL_SECONDS
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function handleOrdersPoll(req: Request, supabase: any): Promise<Response> {
  const runnerToken = req.headers.get('x-runner-token')
  if (!runnerToken) {
    return new Response(
      JSON.stringify({ success: false, error: 'x-runner-token header required' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const runner = await getRunnerByToken(supabase, runnerToken)
  if (!runner) {
    return new Response(
      JSON.stringify({ success: false, error: 'Runner not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Fetch pending orders
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, category, name, command, description, created_at')
    .eq('runner_id', runner.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(10)

  if (error) throw error

  return new Response(
    JSON.stringify({ success: true, orders: orders || [] }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function handleOrdersClaim(req: Request, supabase: any): Promise<Response> {
  const runnerToken = req.headers.get('x-runner-token')
  if (!runnerToken) {
    return new Response(
      JSON.stringify({ success: false, error: 'x-runner-token header required' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const runner = await getRunnerByToken(supabase, runnerToken)
  if (!runner) {
    return new Response(
      JSON.stringify({ success: false, error: 'Runner not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Atomic claim: select first pending and update to running in one go
  const now = new Date().toISOString()

  // Get oldest pending order
  const { data: pendingOrder } = await supabase
    .from('orders')
    .select('id, category, name, command, description')
    .eq('runner_id', runner.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!pendingOrder) {
    return new Response(
      JSON.stringify({ success: true, order: null, message: 'No pending orders' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Atomic update: only succeed if still pending
  const { data: claimedOrder, error } = await supabase
    .from('orders')
    .update({ status: 'running', started_at: now })
    .eq('id', pendingOrder.id)
    .eq('status', 'pending') // Conditional - only if still pending
    .select()
    .maybeSingle()

  if (error) throw error

  if (!claimedOrder) {
    // Another process claimed it first
    return new Response(
      JSON.stringify({ success: true, order: null, message: 'Order already claimed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Log claim
  await supabase.from('runner_logs').insert({
    runner_id: runner.id,
    level: 'info',
    event_type: 'order_claimed',
    message: `Claimed order: ${claimedOrder.name} (${claimedOrder.id})`,
  })

  return new Response(
    JSON.stringify({ 
      success: true, 
      order: {
        id: claimedOrder.id,
        category: claimedOrder.category,
        name: claimedOrder.name,
        command: claimedOrder.command,
        description: claimedOrder.description
      }
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function handleOrdersReport(req: Request, supabase: any): Promise<Response> {
  const runnerToken = req.headers.get('x-runner-token')
  if (!runnerToken) {
    return new Response(
      JSON.stringify({ success: false, error: 'x-runner-token header required' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const contentType = req.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    return new Response(
      JSON.stringify({ success: false, error: 'invalid_content_type', details: 'Content-Type must be application/json' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const runner = await getRunnerByToken(supabase, runnerToken)
  if (!runner) {
    return new Response(
      JSON.stringify({ success: false, error: 'Runner not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const rawBody = await req.text()
  let body: any

  try {
    body = JSON.parse(rawBody)
  } catch (parseError) {
    await supabase.from('runner_report_errors').insert({
      runner_id: runner.id,
      raw_body: rawBody.slice(0, 10000),
      error_type: 'invalid_json',
      error_details: parseError instanceof Error ? parseError.message : 'JSON parse failed',
    })
    await supabase.from('runner_logs').insert({
      runner_id: runner.id,
      level: 'error',
      event_type: 'report_parse_error',
      message: 'Failed to parse /orders/report body - Invalid JSON',
      raw_body: rawBody.slice(0, 5000),
      error_details: parseError instanceof Error ? parseError.message : 'JSON parse failed',
    })
    console.error('Invalid JSON in /orders/report:', rawBody.slice(0, 500))
    return new Response(
      JSON.stringify({ success: false, error: 'invalid_json', details: 'Request body must be valid JSON' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const { 
    order_id, 
    status: reportedStatus,
    started_at,
    finished_at,
    exit_code,
    stdout_tail,
    stderr_tail,
    result,
    error_message,
    meta
  } = body

  if (!order_id || !reportedStatus) {
    const missingFields = []
    if (!order_id) missingFields.push('order_id')
    if (!reportedStatus) missingFields.push('status')

    await supabase.from('runner_logs').insert({
      runner_id: runner.id,
      level: 'warn',
      event_type: 'report_incomplete',
      message: `Incomplete report: missing ${missingFields.join(', ')}`,
      raw_body: rawBody.slice(0, 5000),
      parsed_data: body,
    })

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'missing_required_fields', 
        details: `Required: order_id, status. Missing: ${missingFields.join(', ')}` 
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Log report received
  await supabase.from('runner_logs').insert({
    runner_id: runner.id,
    level: 'info',
    event_type: 'report_received',
    message: `Report: order=${order_id}, status=${reportedStatus}, exit_code=${exit_code ?? 'null'}`,
    raw_body: rawBody.slice(0, 5000),
    parsed_data: body,
  })

  // Determine final status using exit_code as source of truth
  const finalStatus = determineOrderStatus(exit_code ?? null, reportedStatus)
  const reportIncomplete = exit_code === undefined

  // Build update object
  const updateData: Record<string, unknown> = {
    status: finalStatus,
    report_incomplete: reportIncomplete,
  }

  if (reportedStatus === 'running' || started_at) {
    updateData.started_at = started_at || new Date().toISOString()
  }
  
  if (finished_at || (finalStatus === 'completed' || finalStatus === 'failed')) {
    updateData.completed_at = finished_at || new Date().toISOString()
  }

  if (exit_code !== undefined) updateData.exit_code = exit_code
  if (stdout_tail) updateData.stdout_tail = String(stdout_tail).slice(0, 10000)
  if (stderr_tail) updateData.stderr_tail = String(stderr_tail).slice(0, 10000)
  if (result !== undefined) updateData.result = result || {}
  
  if (error_message) {
    updateData.error_message = error_message
  } else if (finalStatus === 'failed' && stderr_tail) {
    updateData.error_message = String(stderr_tail).slice(0, 1000)
  }

  if (meta) updateData.meta = meta

  // Update order
  const { error: updateError } = await supabase
    .from('orders')
    .update(updateData)
    .eq('id', order_id)
    .eq('runner_id', runner.id)

  if (updateError) {
    console.error('Failed to update order:', updateError)
    throw updateError
  }

  // Auto-update infrastructure capabilities on completion
  if (finalStatus === 'completed') {
    await updateInfrastructureCapabilities(supabase, runner, order_id, result, stdout_tail)
  }

  return new Response(
    JSON.stringify({ success: true }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// === CAPABILITY UPDATE HELPER ===

async function updateInfrastructureCapabilities(
  supabase: any,
  runner: any,
  orderId: string,
  result: any,
  stdoutTail: string
) {
  const { data: order } = await supabase
    .from('orders')
    .select('infrastructure_id, category, description, stdout_tail')
    .eq('id', orderId)
    .single()

  if (!order?.infrastructure_id) return

  const { data: infra } = await supabase
    .from('infrastructures')
    .select('capabilities')
    .eq('id', order.infrastructure_id)
    .single()

  const currentCapabilities = (infra?.capabilities || {}) as Record<string, string>
  let updatedCapabilities = { ...currentCapabilities }
  const infraUpdate: Record<string, unknown> = {}

  // 1. Merge explicit capabilities from result
  if (result?.capabilities && typeof result.capabilities === 'object') {
    updatedCapabilities = { ...updatedCapabilities, ...result.capabilities }
  }
  
  // 2. Extract from stdout_tail
  const stdout = order.stdout_tail || stdoutTail
  if (stdout) {
    const stdoutCapabilities = extractCapabilitiesFromStdout(stdout)
    if (stdoutCapabilities) {
      updatedCapabilities = { ...updatedCapabilities, ...stdoutCapabilities }
      console.log('Extracted capabilities from stdout:', stdoutCapabilities)
    }
    
    const systemInfo = extractSystemInfoFromStdout(stdout)
    if (systemInfo) {
      if (systemInfo.os) infraUpdate.os = systemInfo.os
      if (systemInfo.architecture) infraUpdate.architecture = systemInfo.architecture
      if (systemInfo.distribution) infraUpdate.distribution = systemInfo.distribution
      if (systemInfo.cpu_cores) infraUpdate.cpu_cores = systemInfo.cpu_cores
      if (systemInfo.ram_gb) infraUpdate.ram_gb = systemInfo.ram_gb
      if (systemInfo.disk_gb) infraUpdate.disk_gb = systemInfo.disk_gb
      if (systemInfo.provider) updatedCapabilities['provider'] = String(systemInfo.provider)
      console.log('Extracted system info from stdout:', systemInfo)
    }
  }

  // 3. Extract playbook ID and mark verifies as installed
  const playbookMatch = order.description?.match(/^\[([a-z0-9_.]+)\]/)
  if (playbookMatch) {
    const playbookId = playbookMatch[1]
    const PLAYBOOK_VERIFIES: Record<string, string[]> = {
      'system.info': ['system.detected'],
      'system.update': ['system.updated'],
      'system.packages.base': ['curl.installed', 'wget.installed', 'git.installed', 'jq.installed'],
      'essentials.detect': ['essentials.detected'],
      'essentials.tools': ['curl.installed', 'wget.installed', 'git.installed', 'jq.installed'],
      'docker.detect': ['docker.detected'],
      'docker.install_engine': ['docker.installed'],
      'docker.install_compose': ['docker.compose.installed'],
      'docker.verify': ['docker.verified'],
      'runtime.node.detect': ['node.detected'],
      'runtime.node.install_lts': ['node.installed', 'npm.installed'],
      'runtime.node.verify': ['node.verified'],
      'proxy.caddy.install': ['caddy.installed'],
      'proxy.caddy.verify': ['caddy.verified'],
      'supabase.precheck': ['supabase.prerequisites_ok'],
      'supabase.selfhost.up': ['supabase.running'],
      'supabase.selfhost.healthcheck': ['supabase.installed'],
      'supabase.selfhost.install_full': ['supabase.installed'],
    }

    const verifies = PLAYBOOK_VERIFIES[playbookId]
    if (verifies) {
      for (const cap of verifies) {
        updatedCapabilities[cap] = 'installed'
      }
      console.log(`Playbook ${playbookId} completed: marked ${verifies.join(', ')} as installed`)
    }
  }

  // 4. System info from result
  if (result?.system) {
    if (result.system.os) infraUpdate.os = result.system.os
    if (result.system.architecture) infraUpdate.architecture = result.system.architecture
    if (result.system.distribution) infraUpdate.distribution = result.system.distribution
    if (result.system.cpu_cores) infraUpdate.cpu_cores = result.system.cpu_cores
    if (result.system.ram_mb) infraUpdate.ram_gb = Math.round(result.system.ram_mb / 1024)
    if (result.system.disk_gb) infraUpdate.disk_gb = result.system.disk_gb
  }

  infraUpdate.capabilities = updatedCapabilities

  await supabase
    .from('infrastructures')
    .update(infraUpdate)
    .eq('id', order.infrastructure_id)

  await supabase.from('runner_logs').insert({
    runner_id: runner.id,
    level: 'info',
    event_type: 'capabilities_updated',
    message: `Infrastructure capabilities updated after order ${orderId}`,
    parsed_data: { updated_capabilities: updatedCapabilities },
  })
}

// === SCRIPT GENERATORS ===

function generateInstallScript(): string {
  return `#!/bin/bash
set -e

# Colors
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
NC='\\033[0m'

# Parse arguments
TOKEN=""
API_URL=""

while [[ \$# -gt 0 ]]; do
  case \$1 in
    --token) TOKEN="\$2"; shift 2 ;;
    --api-url) API_URL="\$2"; shift 2 ;;
    *) echo -e "\${RED}Unknown option: \$1\${NC}"; exit 1 ;;
  esac
done

if [ -z "\$TOKEN" ] || [ -z "\$API_URL" ]; then
  echo "Usage: install-runner.sh --token <token> --api-url <api-url>"
  exit 1
fi

echo -e "\${GREEN}=== Ikoma Runner Installation v${RUNNER_VERSION} ===\${NC}"
echo "API URL: \$API_URL"
echo ""

RUNNER_NAME=\$(hostname)

# Collect host info
HOST_INFO=\$(cat <<EOF
{
  "hostname": "\$(hostname)",
  "os": "\$(uname -s)",
  "arch": "\$(uname -m)",
  "kernel": "\$(uname -r)",
  "cpus": \$(nproc 2>/dev/null || echo 1),
  "memory_mb": \$(free -m 2>/dev/null | awk '/^Mem:/{print \$2}' || echo 0)
}
EOF
)

echo "Registering runner '\$RUNNER_NAME'..."

RESPONSE=\$(curl -s -X POST "\$API_URL/register" \\
  -H "Content-Type: application/json" \\
  -d "{
    \\"name\\": \\"\$RUNNER_NAME\\",
    \\"token\\": \\"\$TOKEN\\",
    \\"host_info\\": \$HOST_INFO,
    \\"capabilities\\": {}
  }")

echo "Response: \$RESPONSE"

if echo "\$RESPONSE" | grep -q '"success":true'; then
  echo -e "\${GREEN}✓ Runner registered successfully!\${NC}"
else
  echo -e "\${RED}✗ Registration failed\${NC}"
  exit 1
fi

# Install jq if not present
if ! command -v jq &> /dev/null; then
  echo -e "\${YELLOW}Installing jq...\${NC}"
  apt-get update -qq && apt-get install -y -qq jq 2>/dev/null || yum install -y -q jq 2>/dev/null || apk add -q jq 2>/dev/null || {
    echo -e "\${RED}Failed to install jq.\${NC}"
    exit 1
  }
fi

echo -e "\${YELLOW}Creating systemd service...\${NC}"

INSTALL_DIR="/opt/ikoma-runner"
mkdir -p \$INSTALL_DIR

# Create runner script v2.1
cat > \$INSTALL_DIR/runner.sh << 'RUNNER_SCRIPT_EOF'
#!/bin/bash
API_URL="\$1"
TOKEN="\$2"
HEARTBEAT_INTERVAL=\${3:-${HEARTBEAT_INTERVAL_SECONDS}}
POLL_INTERVAL=\${4:-${POLL_INTERVAL_SECONDS}}

LAST_HEARTBEAT=0
RUNNER_VERSION="${RUNNER_VERSION}"

log() {
  echo "\$(date '+%Y-%m-%d %H:%M:%S'): \$1"
}

send_heartbeat() {
  RESPONSE=\$(curl -s -X POST "\$API_URL/heartbeat" \\
    -H "x-runner-token: \$TOKEN" \\
    -H "Content-Type: application/json" \\
    -d "{\"version\": \"\$RUNNER_VERSION\"}" 2>&1)
  if echo "\$RESPONSE" | grep -q '"success":true'; then
    log "Heartbeat OK"
  else
    log "Heartbeat failed: \$RESPONSE"
  fi
}

send_report() {
  local ORDER_ID="\$1"
  local STATUS="\$2"
  local EXIT_CODE="\$3"
  local STDOUT_TAIL="\$4"
  local STDERR_TAIL="\$5"
  local STARTED_AT="\$6"
  local FINISHED_AT="\$7"
  local RESULT="\$8"
  
  local ESCAPED_STDOUT=\$(echo "\$STDOUT_TAIL" | jq -Rs . 2>/dev/null || echo '""')
  local ESCAPED_STDERR=\$(echo "\$STDERR_TAIL" | jq -Rs . 2>/dev/null || echo '""')
  
  local PAYLOAD
  if [ -n "\$RESULT" ]; then
    PAYLOAD="{
  \\"order_id\\": \\"\$ORDER_ID\\",
  \\"status\\": \\"\$STATUS\\",
  \\"exit_code\\": \$EXIT_CODE,
  \\"stdout_tail\\": \$ESCAPED_STDOUT,
  \\"stderr_tail\\": \$ESCAPED_STDERR,
  \\"started_at\\": \\"\$STARTED_AT\\",
  \\"finished_at\\": \\"\$FINISHED_AT\\",
  \\"result\\": \$RESULT,
  \\"meta\\": {\\"runner_version\\": \\"\$RUNNER_VERSION\\"}
}"
  else
    PAYLOAD="{
  \\"order_id\\": \\"\$ORDER_ID\\",
  \\"status\\": \\"\$STATUS\\",
  \\"exit_code\\": \$EXIT_CODE,
  \\"stdout_tail\\": \$ESCAPED_STDOUT,
  \\"stderr_tail\\": \$ESCAPED_STDERR,
  \\"started_at\\": \\"\$STARTED_AT\\",
  \\"finished_at\\": \\"\$FINISHED_AT\\",
  \\"meta\\": {\\"runner_version\\": \\"\$RUNNER_VERSION\\"}
}"
  fi
  
  curl -s -X POST "\$API_URL/orders/report" \\
    -H "x-runner-token: \$TOKEN" \\
    -H "Content-Type: application/json" \\
    -d "\$PAYLOAD" > /dev/null
}

poll_orders() {
  ORDERS=\$(curl -s -X GET "\$API_URL/orders/poll" -H "x-runner-token: \$TOKEN" 2>&1)
  
  if ! echo "\$ORDERS" | grep -q '"success":true'; then
    return
  fi
  
  ORDER_COUNT=\$(echo "\$ORDERS" | jq -r '.orders | length' 2>/dev/null || echo 0)
  
  if [ "\$ORDER_COUNT" -gt 0 ]; then
    log "Found \$ORDER_COUNT pending order(s)"
    
    for i in \$(seq 0 \$((ORDER_COUNT - 1))); do
      ORDER_ID=\$(echo "\$ORDERS" | jq -r ".orders[\$i].id")
      ORDER_NAME=\$(echo "\$ORDERS" | jq -r ".orders[\$i].name")
      ORDER_CMD=\$(echo "\$ORDERS" | jq -r ".orders[\$i].command")
      
      log "Executing order: \$ORDER_NAME (\$ORDER_ID)"
      
      STARTED_AT=\$(date -u +%Y-%m-%dT%H:%M:%SZ)
      send_report "\$ORDER_ID" "running" "null" "" "" "\$STARTED_AT" "null" ""
      
      STDOUT_FILE=\$(mktemp)
      STDERR_FILE=\$(mktemp)
      
      set +e
      bash -c "\$ORDER_CMD" > "\$STDOUT_FILE" 2> "\$STDERR_FILE"
      EXIT_CODE=\$?
      set -e
      
      FINISHED_AT=\$(date -u +%Y-%m-%dT%H:%M:%SZ)
      STDOUT_TAIL=\$(tail -c 10000 "\$STDOUT_FILE" 2>/dev/null || echo "")
      STDERR_TAIL=\$(tail -c 10000 "\$STDERR_FILE" 2>/dev/null || echo "")
      
      if [ "\$EXIT_CODE" -eq 0 ]; then
        STATUS="applied"
        log "Order completed (exit_code=0)"
        
        # Extract JSON result from stdout
        RESULT=""
        JSON_LINE=\$(grep -E '^\\{.*\\}\$' "\$STDOUT_FILE" | tail -1 2>/dev/null || echo "")
        if [ -n "\$JSON_LINE" ] && echo "\$JSON_LINE" | jq . >/dev/null 2>&1; then
          RESULT="\$JSON_LINE"
          log "Extracted JSON result"
        fi
        
        if [ -n "\$RESULT" ]; then
          send_report "\$ORDER_ID" "\$STATUS" "\$EXIT_CODE" "\$STDOUT_TAIL" "\$STDERR_TAIL" "\$STARTED_AT" "\$FINISHED_AT" "\$RESULT"
        else
          send_report "\$ORDER_ID" "\$STATUS" "\$EXIT_CODE" "\$STDOUT_TAIL" "\$STDERR_TAIL" "\$STARTED_AT" "\$FINISHED_AT" ""
        fi
      else
        STATUS="failed"
        log "Order failed (exit_code=\$EXIT_CODE)"
        send_report "\$ORDER_ID" "\$STATUS" "\$EXIT_CODE" "\$STDOUT_TAIL" "\$STDERR_TAIL" "\$STARTED_AT" "\$FINISHED_AT" ""
      fi
      
      rm -f "\$STDOUT_FILE" "\$STDERR_FILE"
    done
  fi
}

log "Starting Ikoma Runner v\$RUNNER_VERSION"
log "API URL: \$API_URL"
log "Heartbeat: \${HEARTBEAT_INTERVAL}s, Poll: \${POLL_INTERVAL}s"

send_heartbeat

while true; do
  CURRENT_TIME=\$(date +%s)
  
  if [ \$((CURRENT_TIME - LAST_HEARTBEAT)) -ge \$HEARTBEAT_INTERVAL ]; then
    send_heartbeat
    LAST_HEARTBEAT=\$CURRENT_TIME
  fi
  
  poll_orders
  sleep \$POLL_INTERVAL
done
RUNNER_SCRIPT_EOF

chmod +x \$INSTALL_DIR/runner.sh

cat > \$INSTALL_DIR/config << CONFIG_EOF
API_URL="\$API_URL"
TOKEN="\$TOKEN"
HEARTBEAT_INTERVAL=${HEARTBEAT_INTERVAL_SECONDS}
POLL_INTERVAL=${POLL_INTERVAL_SECONDS}
VERSION="${RUNNER_VERSION}"
CONFIG_EOF

chmod 600 \$INSTALL_DIR/config

cat > /etc/systemd/system/ikoma-runner.service << SERVICE_EOF
[Unit]
Description=Ikoma Runner Service v${RUNNER_VERSION}
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/bin/bash \$INSTALL_DIR/runner.sh "\$API_URL" "\$TOKEN" ${HEARTBEAT_INTERVAL_SECONDS} ${POLL_INTERVAL_SECONDS}
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SERVICE_EOF

systemctl daemon-reload
systemctl enable ikoma-runner.service
systemctl start ikoma-runner.service

echo ""
echo -e "\${GREEN}✓ Systemd service installed and started!\${NC}"
echo ""
echo "Commands:"
echo "  systemctl status ikoma-runner"
echo "  journalctl -u ikoma-runner -f"
echo ""
echo -e "\${GREEN}Installation complete!\${NC}"
`
}

function generateUninstallScript(): string {
  return `#!/bin/bash
set -e

RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
NC='\\033[0m'

echo -e "\${YELLOW}=== Ikoma Runner Uninstallation ===\${NC}"
echo ""

INSTALL_DIR="/opt/ikoma-runner"
SERVICE_NAME="ikoma-runner"

if systemctl is-active --quiet \$SERVICE_NAME 2>/dev/null; then
  echo "Stopping \$SERVICE_NAME..."
  systemctl stop \$SERVICE_NAME
fi

if systemctl is-enabled --quiet \$SERVICE_NAME 2>/dev/null; then
  echo "Disabling \$SERVICE_NAME..."
  systemctl disable \$SERVICE_NAME
fi

if [ -f "/etc/systemd/system/\$SERVICE_NAME.service" ]; then
  echo "Removing service file..."
  rm -f /etc/systemd/system/\$SERVICE_NAME.service
  systemctl daemon-reload
fi

if [ -d "\$INSTALL_DIR" ]; then
  echo "Removing installation directory..."
  rm -rf \$INSTALL_DIR
fi

echo ""
echo -e "\${GREEN}✓ Ikoma Runner uninstalled!\${NC}"
echo ""
echo -e "\${YELLOW}Note: Delete the runner entry in the dashboard manually.\${NC}"
`
}
