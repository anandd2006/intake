import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "@supabase/supabase-js"

/**
 * email-draft — Generates a professional follow-up email draft from the
 * client's project brief + knowledge base, using Gemini API.
 *
 * Request:  { conversation_id }
 * Response: { subject, body }
 */
interface DraftRequest {
  conversation_id: string
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
}

const DEFAULT_MODELS = ["gemini-3.5-flash", "gemini-2.5-flash", "gemini-2.0-flash"]

async function callGemini(
  apiKey: string,
  model: string,
  prompt: string
): Promise<string> {
  const candidates = model && !DEFAULT_MODELS.includes(model)
    ? [model, ...DEFAULT_MODELS]
    : DEFAULT_MODELS

  for (const candidate of candidates) {
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${candidate}:generateContent?key=${apiKey}`

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 800, responseMimeType: "application/json" },
      }),
    })

    if (!res.ok && [404, 429, 503].includes(res.status)) continue

    if (res.ok) {
      const data = await res.json()
      return data.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || ""
    }

    const errText = await res.text()
    throw new Error(`Gemini API error (${res.status}): ${errText}`)
  }

  throw new Error("All Gemini models failed")
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: CORS_HEADERS,
    })
  }

  try {
    const { conversation_id }: DraftRequest = await req.json()

    if (!conversation_id) {
      return new Response(
        JSON.stringify({ error: "Missing conversation_id" }),
        { status: 400, headers: CORS_HEADERS }
      )
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data: brief } = await supabase
      .from("briefs")
      .select("*")
      .eq("conversation_id", conversation_id)
      .maybeSingle()

    if (!brief) {
      return new Response(
        JSON.stringify({ error: "No brief found for this conversation" }),
        { status: 404, headers: CORS_HEADERS }
      )
    }

    const { data: kbData } = await supabase
      .from("knowledge_base")
      .select("services")
      .limit(1)
      .single()

    const geminiApiKey = Deno.env.get("GEMINI_API_KEY")
    const geminiModel = Deno.env.get("GEMINI_MODEL") || "gemini-3.5-flash"

    // Fallback draft when no API key is configured
    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({
          subject: `Following up on your ${brief.project_type} request`,
          body: `Hi ${brief.client_contact},\n\nThanks for your interest in working together on your ${brief.project_type} project.\n\nBased on our conversation, I have reviewed the scope and would love to discuss next steps. Could you let me know a good time to chat?\n\nLooking forward to hearing from you!\n\nBest regards`,
        }),
        { headers: CORS_HEADERS }
      )
    }

    const servicesStr = Array.isArray(kbData?.services)
      ? (kbData.services as string[]).join(", ")
      : ""

    const prompt = "You are an email drafting assistant for a freelance service provider. " +
      "Generate a professional follow-up email based on the client's project brief.\n\n" +
      "Return ONLY a valid JSON object with exactly two fields: subject and body " +
      "(no markdown, no code fences). The subject is the email subject line; the body is full email body.\n\n" +
      "Guidelines:\n" +
      "- Warm, professional, and concise.\n" +
      "- Reference the specific project type and key scope details.\n" +
      "- Mention the budget range and timeline if available.\n" +
      "- The goal is to move forward — invite a call or reply.\n" +
      '- Do NOT use placeholders like [Your Name]. Sign off as "Best regards".\n' +
      "- Keep the body to 3-5 short paragraphs.\n" +
      "- No markdown formatting in the body.\n\n" +
      "Project Brief:\n" +
      `- Client: ${brief.client_contact}\n` +
      `- Email: ${brief.email || "Not provided"}\n` +
      `- Company: ${brief.company || "Not specified"}\n` +
      `- Project Type: ${brief.project_type}\n` +
      `- Scope: ${brief.scope_summary}\n` +
      `- Budget: ${brief.budget}\n` +
      `- Timeline: ${brief.timeline}\n` +
      `- Urgency: ${brief.urgency}\n\n` +
      `Relevant services: ${servicesStr || "Not specified"}`

    const raw = await callGemini(geminiApiKey, geminiModel, prompt)

    let subject = `Following up on your ${brief.project_type} request`
    let body = `Hi ${brief.client_contact},\n\nThanks for your interest! I have reviewed your project brief and would love to discuss next steps.\n\nBest regards`

    try {
      const cleaned = raw.replace(/```json\n?/g, "").replace(/```/g, "").trim()
      const parsed = JSON.parse(cleaned)
      if (typeof parsed.subject === "string" && parsed.subject.trim()) {
        subject = parsed.subject.trim()
      }
      if (typeof parsed.body === "string" && parsed.body.trim()) {
        body = parsed.body.trim()
      }
    } catch {
      const fallback = raw.match(/\{[\s\S]*"subject"[\s\S]*"body"[\s\S]*\}/)
      if (fallback) {
        try {
          const parsed = JSON.parse(fallback[0])
          if (typeof parsed.subject === "string" && parsed.subject.trim()) {
            subject = parsed.subject.trim()
          }
          if (typeof parsed.body === "string" && parsed.body.trim()) {
            body = parsed.body.trim()
          }
        } catch {
          // Use defaults
        }
      }
    }

    return new Response(
      JSON.stringify({ subject, body }),
      { headers: CORS_HEADERS }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Internal server error",
      }),
      { status: 500, headers: CORS_HEADERS }
    )
  }
})