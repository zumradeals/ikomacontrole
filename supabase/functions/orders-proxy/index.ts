import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ORDERS_API_BASE = "https://automate.ikomadigit.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-ikoma-admin-key",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.searchParams.get("path") || "/health";
    
    // Determine if it's a root endpoint or /v1 endpoint
    const isRootEndpoint = path === "/health" || path === "/ready";
    const targetUrl = isRootEndpoint 
      ? `${ORDERS_API_BASE}${path}`
      : `${ORDERS_API_BASE}/v1${path}`;

    // Forward headers
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Get admin key from environment
    const adminKey = Deno.env.get("IKOMA_ADMIN_KEY");
    if (adminKey) {
      headers["x-ikoma-admin-key"] = adminKey;
    }

    // Forward the request
    const requestOptions: RequestInit = {
      method: req.method,
      headers,
    };

    // Forward body for non-GET requests
    if (req.method !== "GET" && req.method !== "HEAD") {
      const body = await req.text();
      if (body) {
        requestOptions.body = body;
      }
    }

    const startTime = Date.now();
    const response = await fetch(targetUrl, requestOptions);
    const latency = Date.now() - startTime;

    const data = await response.json().catch(() => null);

    return new Response(
      JSON.stringify({
        success: response.ok,
        status: response.status,
        latency,
        data,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Proxy error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        status: 0,
        error: error instanceof Error ? error.message : "Proxy error",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
