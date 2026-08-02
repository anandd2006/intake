import "jsr:@supabase/functions-js/edge-runtime.d.ts"

// Exchanges the server-side Speechmatics API key for a short-lived realtime
// JWT so the widget can open a direct WebSocket. Never exposes the API key.
// Falls back gracefully (400) when voice is not configured — the widget
// silently hides the mic button in that case.

Deno.serve(async (req: Request) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers })
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers,
    })
  }

  const apiKey = Deno.env.get("SPEECHMATICS_API_KEY")

  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Voice not configured" }), {
      status: 400,
      headers,
    })
  }

  try {
    const res = await fetch("https://mp.speechmatics.com/v1/api_keys", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })

    if (!res.ok) {
      return new Response(JSON.stringify({ error: "Voice token request failed" }), {
        status: 502,
        headers,
      })
    }

    const data = await res.json()
    const jwt = data.key || data.jwt || data.token

    if (!jwt) {
      return new Response(JSON.stringify({ error: "Voice token request failed" }), {
        status: 502,
        headers,
      })
    }

    return new Response(
      JSON.stringify({
        jwt,
        url: "wss://realtime.rt.speechmatics.com/v2",
      }),
      { headers }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Voice token request failed",
      }),
      { status: 502, headers }
    )
  }
})
