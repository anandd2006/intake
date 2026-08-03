import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "@supabase/supabase-js"

/**
 * send-email — Sends a finalized follow-up email to a client via Resend.
 *
 * Security model:
 *  - Requires a valid authenticated user JWT (freelancer session). The user's
 *    email from the JWT is used as the CC recipient, so a caller can never
 *    spoof who the copy goes to.
 *  - The RESEND_API_KEY secret never leaves the Edge Function.
 *
 * Request:  { to, subject, body, conversation_id }
 * Response: { success: true, id } | { error }
 */

interface SendEmailRequest {
  to: string
  subject: string
  body: string
  conversation_id: string
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: CORS_HEADERS }
    )
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const resendApiKey = Deno.env.get("RESEND_API_KEY")
  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev"

  // ── 1. Verify the caller is an authenticated freelancer ──
  const authHeader = req.headers.get("Authorization") || ""
  const token = authHeader.replace(/^Bearer\s+/i, "")

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser(token)

  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: "Unauthorized — please sign in" }),
      { status: 401, headers: CORS_HEADERS }
    )
  }

  const freelancerEmail = user.email
  if (!freelancerEmail) {
    return new Response(
      JSON.stringify({ error: "Your account has no email address to copy" }),
      { status: 400, headers: CORS_HEADERS }
    )
  }

  // ── 2. Validate request ──
  let body: SendEmailRequest
  try {
    body = await req.json()
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: CORS_HEADERS }
    )
  }

  const { to, subject, body: emailBody, conversation_id } = body

  if (!to || !subject || !emailBody) {
    return new Response(
      JSON.stringify({ error: "Missing required fields: to, subject, body" }),
      { status: 400, headers: CORS_HEADERS }
    )
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(to)) {
    return new Response(
      JSON.stringify({ error: "Recipient email address is invalid" }),
      { status: 400, headers: CORS_HEADERS }
    )
  }

  // ── 3. Verify the conversation exists (defense in depth) ──
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  if (conversation_id) {
    const { data: conv } = await adminClient
      .from("conversations")
      .select("id")
      .eq("id", conversation_id)
      .maybeSingle()

    if (!conv) {
      return new Response(
        JSON.stringify({ error: "Conversation not found" }),
        { status: 404, headers: CORS_HEADERS }
      )
    }
  }

  // ── 4. Send via Resend API ──
  if (!resendApiKey) {
    return new Response(
      JSON.stringify({
        error: "Email sending is not configured — add the RESEND_API_KEY secret",
      }),
      { status: 503, headers: CORS_HEADERS }
    )
  }

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendApiKey}`,
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [to],
      cc: [freelancerEmail],
      subject,
      text: emailBody,
    }),
  })

  const resendData = await resendResponse.json().catch(() => null)

  if (!resendResponse.ok) {
    const message =
      resendData?.message || `Resend API error (${resendResponse.status})`
    return new Response(
      JSON.stringify({ error: message }),
      { status: 502, headers: CORS_HEADERS }
    )
  }

  // ── 5. Record the send on the conversation ──
  if (conversation_id) {
    await adminClient
      .from("conversations")
      .update({ email_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", conversation_id)
  }

  return new Response(
    JSON.stringify({
      success: true,
      id: resendData?.id || null,
      to,
      cc: freelancerEmail,
    }),
    { status: 200, headers: CORS_HEADERS }
  )
})
