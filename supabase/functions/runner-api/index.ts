import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-runner-token',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

// Helper to hash token
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(token)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// Helper to get runner by token
async function getRunnerByToken(supabase: any, token: string) {
  const tokenHash = await hashToken(token)
  const { data: runner } = await supabase
    .from('runners')
    .select('id, status, name')
    .eq('token_hash', tokenHash)
    .maybeSingle()
  return runner
}

// Determine final status based on exit_code (source of truth)
function determineOrderStatus(exitCode: number | null, reportedStatus: string): 'running' | 'completed' | 'failed' {
  // If running, keep as running
  if (reportedStatus === 'running') return 'running'
  
  // Use exit_code as source of truth for final status
  if (exitCode === 0) return 'completed'
  if (exitCode !== null && exitCode !== 0) return 'failed'
  
  // Fallback to reported status if no exit_code
  if (reportedStatus === 'completed' || reportedStatus === 'applied') return 'completed'
  if (reportedStatus === 'failed') return 'failed'
  
  // Default to failed if ambiguous with finished report
  return 'failed'
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const url = new URL(req.url)
  const pathname = url.pathname
  
  console.log('Incoming request:', req.method, pathname)
  
  // Extract path
  let path = pathname
  if (path.includes('/runner-api')) {
    const idx = path.indexOf('/runner-api')
    path = path.substring(idx + '/runner-api'.length)
  }
  
  if (!path || path === '') {
    path = '/'
  } else if (!path.startsWith('/')) {
    path = '/' + path
  }
  
  console.log('Normalized path:', path)

  try {
    // GET /health - Public health check
    if (req.method === 'GET' && path === '/health') {
      return new Response(
        JSON.stringify({ 
          status: 'ok', 
          timestamp: new Date().toISOString(),
          version: '2.0.0'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // GET /install-runner.sh - Installation script
    if (req.method === 'GET' && path === '/install-runner.sh') {
      const installScript = generateInstallScript()
      return new Response(installScript, { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'text/plain; charset=utf-8' 
        } 
      })
    }

    // GET /uninstall-runner.sh - Uninstallation script
    if (req.method === 'GET' && path === '/uninstall-runner.sh') {
      const uninstallScript = generateUninstallScript()
      return new Response(uninstallScript, { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'text/plain; charset=utf-8' 
        } 
      })
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // POST /register - Runner registration
    if (req.method === 'POST' && path === '/register') {
      return await handleRegister(req, supabase)
    }

    // POST /heartbeat - Runner heartbeat
    if (req.method === 'POST' && path === '/heartbeat') {
      return await handleHeartbeat(req, supabase)
    }

    // GET /orders/poll - Poll for pending orders
    if (req.method === 'GET' && path === '/orders/poll') {
      return await handleOrdersPoll(req, supabase)
    }

    // POST /orders/report - Report order execution (STRICT JSON only)
    if (req.method === 'POST' && path === '/orders/report') {
      return await handleOrdersReport(req, supabase)
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

// ============ HANDLERS ============

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

  // Fetch pending orders for this runner
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('id, category, name, command, description, created_at')
    .eq('runner_id', runner.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(10)

  if (ordersError) throw ordersError

  return new Response(
    JSON.stringify({ success: true, orders: orders || [] }),
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

  // Check Content-Type
  const contentType = req.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'invalid_content_type', 
        details: 'Content-Type must be application/json' 
      }),
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

  // Strict JSON parsing only
  let body: any
  try {
    body = JSON.parse(rawBody)
  } catch (parseError) {
    // Store in runner_report_errors for debugging
    await supabase.from('runner_report_errors').insert({
      runner_id: runner.id,
      raw_body: rawBody.slice(0, 10000),
      error_type: 'invalid_json',
      error_details: parseError instanceof Error ? parseError.message : 'JSON parse failed',
    })

    // Also log to runner_logs
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
      JSON.stringify({ 
        success: false, 
        error: 'invalid_json', 
        details: 'Request body must be valid JSON' 
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Validate required fields
  const { 
    order_id, 
    runner_id,
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

  // Determine which fields are missing
  const missingFields: string[] = []
  if (!order_id) missingFields.push('order_id')
  if (!reportedStatus) missingFields.push('status')

  const reportIncomplete = missingFields.length > 0 || exit_code === undefined

  if (!order_id || !reportedStatus) {
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
        details: `Required fields: order_id, status. Missing: ${missingFields.join(', ')}` 
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Log successful report reception
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

  // Build update object
  const updateData: Record<string, unknown> = {
    status: finalStatus,
    report_incomplete: reportIncomplete,
  }

  // Handle timestamps
  if (reportedStatus === 'running' || started_at) {
    updateData.started_at = started_at || new Date().toISOString()
  }
  
  if (finished_at || (finalStatus === 'completed' || finalStatus === 'failed')) {
    updateData.completed_at = finished_at || new Date().toISOString()
  }

  // Store exit_code
  if (exit_code !== undefined) {
    updateData.exit_code = exit_code
  }

  // Store output tails
  if (stdout_tail) {
    updateData.stdout_tail = String(stdout_tail).slice(0, 10000)
  }
  if (stderr_tail) {
    updateData.stderr_tail = String(stderr_tail).slice(0, 10000)
  }

  // Store result
  if (result !== undefined) {
    updateData.result = result || {}
  }

  // Store error message (prioritize stderr_tail if error_message not provided)
  if (error_message) {
    updateData.error_message = error_message
  } else if (finalStatus === 'failed' && stderr_tail) {
    updateData.error_message = String(stderr_tail).slice(0, 1000)
  }

  // Store meta (playbook, version, etc.)
  if (meta) {
    updateData.meta = meta
  }

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

  // Auto-update infrastructure capabilities on successful order
  if (finalStatus === 'completed') {
    const { data: order } = await supabase
      .from('orders')
      .select('infrastructure_id, category, description')
      .eq('id', order_id)
      .single()

    if (order?.infrastructure_id) {
      // Get current infrastructure capabilities
      const { data: infra } = await supabase
        .from('infrastructures')
        .select('capabilities')
        .eq('id', order.infrastructure_id)
        .single()

      const currentCapabilities = (infra?.capabilities || {}) as Record<string, string>
      let updatedCapabilities = { ...currentCapabilities }
      const infraUpdate: Record<string, unknown> = {}

      // 1. If result contains explicit capabilities, merge them
      if (result?.capabilities && typeof result.capabilities === 'object') {
        updatedCapabilities = { ...updatedCapabilities, ...result.capabilities }
      }

      // 2. Extract playbook ID from description and mark its verifies as installed
      // Description format: "[playbook.id] description text"
      const playbookMatch = order.description?.match(/^\[([a-z0-9_.]+)\]/)
      if (playbookMatch) {
        const playbookId = playbookMatch[1]
        // Playbook verifies mapping (server-side copy of what the playbook verifies)
        const PLAYBOOK_VERIFIES: Record<string, string[]> = {
          'system.info': ['system.detected'],
          'system.update': ['system.updated'],
          'system.packages.base': ['curl.installed', 'wget.installed', 'git.installed', 'jq.installed'],
          'system.timezone.set': ['timezone.configured'],
          'system.swap.ensure': ['swap.configured'],
          'net.dns.check': ['dns.working'],
          'firewall.ufw.baseline': ['firewall.configured'],
          'ssh.hardening': ['ssh.hardened'],
          'fail2ban.install': ['fail2ban.installed'],
          'runtime.node.install_lts': ['node.installed', 'npm.installed'],
          'runtime.node.verify': ['node.verified'],
          'runtime.python.install': ['python.installed'],
          'runtime.pm2.install': ['pm2.installed'],
          'docker.install_engine': ['docker.installed'],
          'docker.install_compose': ['docker.compose.installed'],
          'docker.postinstall': ['docker.usermod'],
          'docker.verify': ['docker.verified'],
          'proxy.caddy.install': ['caddy.installed'],
          'proxy.caddy.verify': ['caddy.verified'],
          'proxy.nginx.install': ['nginx.installed'],
          'tls.acme.precheck': ['acme.ready'],
          'monitor.prometheus.install': ['prometheus.installed'],
          'monitor.node_exporter.install': ['node_exporter.installed'],
          'monitor.grafana.install': ['grafana.installed'],
          'supabase.precheck': ['supabase.prerequisites_ok'],
          'supabase.install_cli': ['supabase.cli_installed'],
          'supabase.selfhost.up': ['supabase.running'],
          'supabase.selfhost.healthcheck': ['supabase.healthy'],
          'maintenance.cleanup': ['cleanup.done'],
          'maintenance.logs.rotate': ['logs.rotated'],
        }

        const verifies = PLAYBOOK_VERIFIES[playbookId]
        if (verifies) {
          for (const cap of verifies) {
            updatedCapabilities[cap] = 'installed'
          }
          console.log(`Playbook ${playbookId} completed: marked ${verifies.join(', ')} as installed`)
        }
      }

      // 3. If detection category with system info, update infrastructure specs
      if (result?.system) {
        if (result.system.os) infraUpdate.os = result.system.os
        if (result.system.architecture) infraUpdate.architecture = result.system.architecture
        if (result.system.distribution) infraUpdate.distribution = result.system.distribution
        if (result.system.cpu_cores) infraUpdate.cpu_cores = result.system.cpu_cores
        if (result.system.ram_mb) infraUpdate.ram_gb = Math.round(result.system.ram_mb / 1024)
        if (result.system.disk_gb) infraUpdate.disk_gb = result.system.disk_gb
      }

      // Apply capabilities update
      infraUpdate.capabilities = updatedCapabilities

      await supabase
        .from('infrastructures')
        .update(infraUpdate)
        .eq('id', order.infrastructure_id)

      // Log capability update
      await supabase.from('runner_logs').insert({
        runner_id: runner.id,
        level: 'info',
        event_type: 'capabilities_updated',
        message: `Infrastructure capabilities updated after order ${order_id}`,
        parsed_data: { updated_capabilities: updatedCapabilities },
      })
    }
  }

  return new Response(
    JSON.stringify({ success: true }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// ============ SCRIPT GENERATORS ============

function generateInstallScript(): string {
  return `#!/bin/bash
set -e

# Colors for output
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
NC='\\033[0m' # No Color

# Parse arguments
TOKEN=""
API_URL=""

while [[ \$# -gt 0 ]]; do
  case \$1 in
    --token)
      TOKEN="\$2"
      shift 2
      ;;
    --api-url)
      API_URL="\$2"
      shift 2
      ;;
    *)
      echo -e "\${RED}Unknown option: \$1\${NC}"
      exit 1
      ;;
  esac
done

if [ -z "\$TOKEN" ] || [ -z "\$API_URL" ]; then
  echo "Usage: install-runner.sh --token <token> --api-url <api-url>"
  exit 1
fi

echo -e "\${GREEN}=== Ikoma Runner Installation v2.0 ===\${NC}"
echo "API URL: \$API_URL"
echo ""

# Get hostname for runner name
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

# Register with the API
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
  echo ""
  echo -e "\${GREEN}✓ Runner registered successfully!\${NC}"
else
  echo ""
  echo -e "\${RED}✗ Registration failed\${NC}"
  exit 1
fi

# Install jq if not present
if ! command -v jq &> /dev/null; then
  echo -e "\${YELLOW}Installing jq...\${NC}"
  apt-get update -qq && apt-get install -y -qq jq 2>/dev/null || yum install -y -q jq 2>/dev/null || apk add -q jq 2>/dev/null || {
    echo -e "\${RED}Failed to install jq. Please install it manually.\${NC}"
    exit 1
  }
fi

# Create systemd service
echo ""
echo -e "\${YELLOW}Creating systemd service...\${NC}"

INSTALL_DIR="/opt/ikoma-runner"
mkdir -p \$INSTALL_DIR

# Create main runner script (v2 with proper JSON reporting)
cat > \$INSTALL_DIR/runner.sh << 'RUNNER_SCRIPT_EOF'
#!/bin/bash
API_URL="\$1"
TOKEN="\$2"
HEARTBEAT_INTERVAL=\${3:-30}
POLL_INTERVAL=\${4:-5}

LAST_HEARTBEAT=0
RUNNER_VERSION="2.0.0"

log() {
  echo "\$(date '+%Y-%m-%d %H:%M:%S'): \$1"
}

send_heartbeat() {
  RESPONSE=\$(curl -s -X POST "\$API_URL/heartbeat" \\
    -H "x-runner-token: \$TOKEN" \\
    -H "Content-Type: application/json" \\
    -d "{\"version\": \"\$RUNNER_VERSION\", \"seen_at\": \"\$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" 2>&1)
  if echo "\$RESPONSE" | grep -q '"success":true'; then
    log "Heartbeat OK"
  else
    log "Heartbeat failed: \$RESPONSE"
  fi
}

# Send report with proper JSON format (v2 contract)
send_report() {
  local ORDER_ID="\$1"
  local STATUS="\$2"
  local EXIT_CODE="\$3"
  local STDOUT_TAIL="\$4"
  local STDERR_TAIL="\$5"
  local STARTED_AT="\$6"
  local FINISHED_AT="\$7"
  local RESULT="\$8"
  
  # Escape strings for JSON
  local ESCAPED_STDOUT=\$(echo "\$STDOUT_TAIL" | jq -Rs . 2>/dev/null || echo '""')
  local ESCAPED_STDERR=\$(echo "\$STDERR_TAIL" | jq -Rs . 2>/dev/null || echo '""')
  
  # Build JSON payload
  local PAYLOAD
  if [ -n "\$RESULT" ]; then
    PAYLOAD=\$(cat <<PAYLOAD_EOF
{
  "order_id": "\$ORDER_ID",
  "status": "\$STATUS",
  "exit_code": \$EXIT_CODE,
  "stdout_tail": \$ESCAPED_STDOUT,
  "stderr_tail": \$ESCAPED_STDERR,
  "started_at": "\$STARTED_AT",
  "finished_at": "\$FINISHED_AT",
  "result": \$RESULT,
  "meta": {"runner_version": "\$RUNNER_VERSION"}
}
PAYLOAD_EOF
)
  else
    PAYLOAD=\$(cat <<PAYLOAD_EOF
{
  "order_id": "\$ORDER_ID",
  "status": "\$STATUS",
  "exit_code": \$EXIT_CODE,
  "stdout_tail": \$ESCAPED_STDOUT,
  "stderr_tail": \$ESCAPED_STDERR,
  "started_at": "\$STARTED_AT",
  "finished_at": "\$FINISHED_AT",
  "meta": {"runner_version": "\$RUNNER_VERSION"}
}
PAYLOAD_EOF
)
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
      ORDER_CATEGORY=\$(echo "\$ORDERS" | jq -r ".orders[\$i].category")
      
      log "Executing order: \$ORDER_NAME (\$ORDER_ID)"
      
      STARTED_AT=\$(date -u +%Y-%m-%dT%H:%M:%SZ)
      
      # Report running status
      send_report "\$ORDER_ID" "running" "null" "" "" "\$STARTED_AT" "null" ""
      
      # Execute command and capture output
      STDOUT_FILE=\$(mktemp)
      STDERR_FILE=\$(mktemp)
      
      set +e
      bash -c "\$ORDER_CMD" > "\$STDOUT_FILE" 2> "\$STDERR_FILE"
      EXIT_CODE=\$?
      set -e
      
      FINISHED_AT=\$(date -u +%Y-%m-%dT%H:%M:%SZ)
      
      # Read outputs (last 10KB)
      STDOUT_TAIL=\$(tail -c 10000 "\$STDOUT_FILE" 2>/dev/null || echo "")
      STDERR_TAIL=\$(tail -c 10000 "\$STDERR_FILE" 2>/dev/null || echo "")
      
      # Determine status based on exit code (source of truth)
      if [ "\$EXIT_CODE" -eq 0 ]; then
        STATUS="applied"
        log "Order completed successfully (exit_code=0)"
        
        # For detection orders, try to extract structured result
        if [ "\$ORDER_CATEGORY" = "detection" ]; then
          RESULT=\$(grep -E '^\\{.*\\}\$' "\$STDOUT_FILE" | tail -1 2>/dev/null || echo "")
          if [ -n "\$RESULT" ] && echo "\$RESULT" | jq . >/dev/null 2>&1; then
            send_report "\$ORDER_ID" "\$STATUS" "\$EXIT_CODE" "\$STDOUT_TAIL" "\$STDERR_TAIL" "\$STARTED_AT" "\$FINISHED_AT" "\$RESULT"
          else
            send_report "\$ORDER_ID" "\$STATUS" "\$EXIT_CODE" "\$STDOUT_TAIL" "\$STDERR_TAIL" "\$STARTED_AT" "\$FINISHED_AT" "{\"output\": \"Detection completed\"}"
          fi
        else
          send_report "\$ORDER_ID" "\$STATUS" "\$EXIT_CODE" "\$STDOUT_TAIL" "\$STDERR_TAIL" "\$STARTED_AT" "\$FINISHED_AT" ""
        fi
      else
        STATUS="failed"
        log "Order failed with exit_code=\$EXIT_CODE"
        send_report "\$ORDER_ID" "\$STATUS" "\$EXIT_CODE" "\$STDOUT_TAIL" "\$STDERR_TAIL" "\$STARTED_AT" "\$FINISHED_AT" ""
      fi
      
      rm -f "\$STDOUT_FILE" "\$STDERR_FILE"
    done
  fi
}

log "Starting Ikoma Runner v\$RUNNER_VERSION"
log "API URL: \$API_URL"
log "Heartbeat interval: \${HEARTBEAT_INTERVAL}s, Poll interval: \${POLL_INTERVAL}s"

# Initial heartbeat
send_heartbeat

while true; do
  CURRENT_TIME=\$(date +%s)
  
  # Send heartbeat every HEARTBEAT_INTERVAL seconds
  if [ \$((CURRENT_TIME - LAST_HEARTBEAT)) -ge \$HEARTBEAT_INTERVAL ]; then
    send_heartbeat
    LAST_HEARTBEAT=\$CURRENT_TIME
  fi
  
  # Poll for orders
  poll_orders
  
  sleep \$POLL_INTERVAL
done
RUNNER_SCRIPT_EOF

chmod +x \$INSTALL_DIR/runner.sh

# Save configuration
cat > \$INSTALL_DIR/config << CONFIG_EOF
API_URL="\$API_URL"
TOKEN="\$TOKEN"
HEARTBEAT_INTERVAL=30
POLL_INTERVAL=5
VERSION="2.0.0"
CONFIG_EOF

chmod 600 \$INSTALL_DIR/config

# Create systemd service file
cat > /etc/systemd/system/ikoma-runner.service << SERVICE_EOF
[Unit]
Description=Ikoma Runner Service v2.0
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/bin/bash \$INSTALL_DIR/runner.sh "\$API_URL" "\$TOKEN" 30 5
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SERVICE_EOF

# Reload systemd and enable service
systemctl daemon-reload
systemctl enable ikoma-runner.service
systemctl start ikoma-runner.service

echo ""
echo -e "\${GREEN}✓ Systemd service installed and started!\${NC}"
echo ""
echo "Useful commands:"
echo "  systemctl status ikoma-runner    - Check service status"
echo "  journalctl -u ikoma-runner -f    - View logs"
echo "  systemctl restart ikoma-runner   - Restart service"
echo "  systemctl stop ikoma-runner      - Stop service"
echo ""
echo -e "\${GREEN}Installation complete!\${NC}"
`
}

function generateUninstallScript(): string {
  return `#!/bin/bash
set -e

# Colors for output
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
NC='\\033[0m' # No Color

echo -e "\${YELLOW}=== Ikoma Runner Uninstallation ===\${NC}"
echo ""

INSTALL_DIR="/opt/ikoma-runner"
SERVICE_NAME="ikoma-runner"

# Stop and disable the service
if systemctl is-active --quiet \$SERVICE_NAME 2>/dev/null; then
  echo "Stopping \$SERVICE_NAME service..."
  systemctl stop \$SERVICE_NAME
fi

if systemctl is-enabled --quiet \$SERVICE_NAME 2>/dev/null; then
  echo "Disabling \$SERVICE_NAME service..."
  systemctl disable \$SERVICE_NAME
fi

# Remove service file
if [ -f "/etc/systemd/system/\$SERVICE_NAME.service" ]; then
  echo "Removing systemd service file..."
  rm -f /etc/systemd/system/\$SERVICE_NAME.service
  systemctl daemon-reload
fi

# Remove installation directory
if [ -d "\$INSTALL_DIR" ]; then
  echo "Removing installation directory..."
  rm -rf \$INSTALL_DIR
fi

echo ""
echo -e "\${GREEN}✓ Ikoma Runner uninstalled successfully!\${NC}"
echo ""
echo -e "\${YELLOW}Note: The runner entry in the dashboard must be deleted manually.\${NC}"
`
}
