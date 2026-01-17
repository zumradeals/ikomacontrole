/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-runner-id, x-runner-token",
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
      console.error("[runner-proxy] Missing AUTOMATE_BASE_URL secret");
      return new Response(JSON.stringify({ 
        error: "Configuration Error", 
        message: "Missing AUTOMATE_BASE_URL in Supabase Secrets" 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { method, path, runnerId, runnerToken, body } = await req.json();

    console.info("proxy_request", { path, method, runnerId: runnerId?.slice(0, 8) + "..." });

    if (!path || !runnerId || !runnerToken) {
      console.error("[runner-proxy] Missing required fields");
      return new Response(JSON.stringify({ 
        error: "Bad Request", 
        message: "path, runnerId, runnerToken are required" 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const targetUrl = `${baseUrl}/v1${path}`;
    console.info("proxy_target", targetUrl);

    // Build headers with both auth models for maximum compatibility
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-runner-id": runnerId,
      "x-runner-token": runnerToken,
      "Authorization": `Bearer ${runnerToken}`, // double support
    };

    const httpMethod = method || "POST";
    const fetchOptions: RequestInit = {
      method: httpMethod,
      headers,
    };

    // Only add body for methods that support it
    if (["POST", "PUT", "PATCH"].includes(httpMethod)) {
      fetchOptions.body = JSON.stringify(body ?? {});
    }

    try {
      const res = await fetch(targetUrl, fetchOptions);
      console.info("proxy_status", res.status);

      const contentType = res.headers.get("content-type") || "";
      let data: unknown;

      if (contentType.includes("application/json")) {
        data = await res.json();
      } else {
        data = { message: await res.text() };
      }

      // If backend returns 204 No Content, data might be empty
      if (res.status === 204) {
        return new Response(null, {
          status: 204,
          headers: corsHeaders,
        });
      }

      return new Response(JSON.stringify(data), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (fetchError) {
      console.error("proxy_fetch_error", fetchError);
      return new Response(JSON.stringify({ 
        error: "API Unreachable", 
        message: "Failed to connect to the backend API. It might be down or unreachable from the edge function.",
        details: String(fetchError)
      }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    console.error("[runner-proxy] Internal Error:", String(e));
    return new Response(JSON.stringify({ 
      error: "Internal Proxy Error", 
      message: String(e) 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
