/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

/**
 * Public Proxy Edge Function
 * Forwards requests to public API endpoints (no auth required)
 * Used for: /health, /ready, etc.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const baseUrl = Deno.env.get("AUTOMATE_BASE_URL");
    if (!baseUrl) {
      console.error("[public-proxy] Missing AUTOMATE_BASE_URL secret");
      return new Response(JSON.stringify({ 
        error: "Configuration Error", 
        message: "Missing AUTOMATE_BASE_URL in Supabase Secrets" 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { method, path } = await req.json();

    console.info("[public-proxy] Request received:", { method, path });

    if (!path) {
      return new Response(JSON.stringify({ 
        error: "Bad Request", 
        message: "path is required" 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build target URL (no /v1 prefix for public endpoints like /health)
    const targetUrl = `${baseUrl}${path}`;
    console.info("[public-proxy] Forwarding to:", targetUrl);

    const httpMethod = method || "GET";

    try {
      const res = await fetch(targetUrl, {
        method: httpMethod,
        headers: { "Content-Type": "application/json" },
      });

      console.info("[public-proxy] Backend response status:", res.status);

      const contentType = res.headers.get("content-type") || "";
      let data: unknown;

      if (contentType.includes("application/json")) {
        data = await res.json();
      } else {
        data = { message: await res.text() };
      }

      console.info("[public-proxy] Response data:", JSON.stringify(data));

      return new Response(JSON.stringify(data), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (fetchError) {
      console.error("[public-proxy] Fetch error:", fetchError);
      return new Response(JSON.stringify({ 
        error: "API Unreachable", 
        message: "Failed to connect to the backend API",
        details: String(fetchError)
      }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    console.error("[public-proxy] Internal Error:", String(e));
    return new Response(JSON.stringify({ 
      error: "Internal Proxy Error", 
      message: String(e) 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
