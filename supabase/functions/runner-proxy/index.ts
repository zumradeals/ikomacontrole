/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

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
      console.error("[runner-proxy] Missing AUTOMATE_BASE_URL secret");
      return new Response(JSON.stringify({ error: "Missing AUTOMATE_BASE_URL" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { method, path, runnerId, runnerToken, body } = await req.json();

    console.log("[runner-proxy] Request received:", { method, path, runnerId: runnerId?.slice(0, 8) + "..." });

    if (!path || !runnerId || !runnerToken) {
      console.error("[runner-proxy] Missing required fields");
      return new Response(JSON.stringify({ error: "path, runnerId, runnerToken are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const targetUrl = `${baseUrl}/v1${path}`;
    console.log("[runner-proxy] Forwarding to:", targetUrl);

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

    const res = await fetch(targetUrl, fetchOptions);

    console.log("[runner-proxy] Backend response status:", res.status);

    const contentType = res.headers.get("content-type") || "";
    let data: unknown;

    if (contentType.includes("application/json")) {
      data = await res.json();
    } else {
      data = await res.text();
    }

    console.log("[runner-proxy] Response data:", typeof data === "object" ? JSON.stringify(data) : data);

    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[runner-proxy] Error:", String(e));
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
