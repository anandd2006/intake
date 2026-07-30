import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "@supabase/supabase-js"

// ─── Types ────────────────────────────────────────────────────────────────

interface ChatRequest {
  message: string
  conversation_id: string | null // null = first message, create new conversation
  visitor_id?: string | null
}

interface KnowledgeBaseRow {
  id: string
  services: string[]
  pricing_ranges: string[]
  availability: string
  out_of_scope_rules: string[]
  past_projects: string[]
}

interface LLMResponse {
  reply: string
  classification: "qualified" | "needs_info" | "out_of_scope" | "active"
  brief: BriefData | null
}

interface BriefData {
  client_contact: string
  project_type: string
  scope_summary: string
  budget: string
  timeline: string
  urgency: string
}

interface MessageRow {
  role: "user" | "assistant" | "system"
  content: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function buildSystemPrompt(kb: KnowledgeBaseRow): string {
  return `You are the Intake Assistant — an AI client intake copilot for a freelance designer/developer.

Your job is to have a natural conversation with a potential client, understand their project, and determine if they're a good fit.

## Knowledge Base — Use this to ground every response:

### Services Offered
${kb.services.map((s) => `- ${s}`).join("\n") || "Not specified — ask the freelancer."}

### Pricing Ranges
${kb.pricing_ranges.map((p) => `- ${p}`).join("\n") || "Not specified — do not quote prices."}

### Current Availability
${kb.availability || "Not specified — say you need to check."}

### Out of Scope (Services NOT offered)
${kb.out_of_scope_rules.map((r) => `- ${r}`).join("\n") || "None specified."}

### Past Projects
${kb.past_projects.map((p) => `- ${p}`).join("\n") || "Not specified."}

## Conversation Guidelines
- Be conversational and warm — you're the first impression.
- Do NOT ask questions the visitor has already answered.
- Clarify ONLY: budget range, timeline, project scope details.
- If the project is clearly out of scope (service not offered, budget too low), politely explain why and optionally suggest where they might look instead.
- If you have enough information to classify, do so.
- Keep responses concise but friendly. No markdown formatting.
- At the end of your response, include a JSON block with your classification and any brief data.

## Output Format
At the end of your response, include a JSON code block like:
\`\`\`json
{"classification":"needs_info","brief":null}\`\`\`

Classification options:
- "active" — conversation is ongoing, not yet ready to classify
- "qualified" — project is in scope, budget and timeline mentioned, ready for follow-up
- "needs_info" — project seems in scope but need more details (budget, timeline, contact info)
- "out_of_scope" — service not offered or budget clearly below minimum

When classification is "qualified", include brief fields:
- client_contact: the visitor's name/email if shared
- project_type: what type of project
- scope_summary: 1-2 sentence summary of the work
- budget: stated budget or range
- timeline: stated timeline
- urgency: stated urgency level`
}

function parseLLMResponse(text: string): { reply: string; classification: string; brief: BriefData | null } {
  // Default in case JSON parsing fails
  let classification = "active"
  let brief: BriefData | null = null

  // Try to extract JSON block
  const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1])
      classification = parsed.classification || "active"

      if (parsed.brief && parsed.brief.project_type) {
        brief = {
          client_contact: parsed.brief.client_contact || "",
          project_type: parsed.brief.project_type || "",
          scope_summary: parsed.brief.scope_summary || "",
          budget: parsed.brief.budget || "",
          timeline: parsed.brief.timeline || "",
          urgency: parsed.brief.urgency || "",
        }
      }
    } catch {
      // Invalid JSON, ignore
    }
  }

  // Clean the reply (remove the JSON block)
  const reply = text.replace(/```json\n[\s\S]*?\n```/, "").trim()

  return { reply, classification, brief }
}

// ─── Main Handler ─────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // CORS headers for the widget
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json",
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers,
    })
  }

  try {
    const body: ChatRequest = await req.json()
    const { message, conversation_id, visitor_id } = body

    if (!message || typeof message !== "string") {
      return new Response(JSON.stringify({ error: "Missing 'message' field" }), {
        status: 400,
        headers,
      })
    }

    // ── Supabase client (service role for DB access) ──
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // ── Load knowledge base ──
    const { data: kbData, error: kbError } = await supabase
      .from("knowledge_base")
      .select("*")
      .limit(1)
      .single()

    if (kbError || !kbData) {
      throw new Error("Failed to load knowledge base: " + (kbError?.message || "No KB found"))
    }

    const kb = kbData as unknown as KnowledgeBaseRow

    // ── Load conversation history ──
    let convId = conversation_id
    let existingMessages: MessageRow[] = []

    if (convId) {
      // Fetch existing messages
      const { data: msgs } = await supabase
        .from("messages")
        .select("role, content")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true })

      if (msgs) {
        existingMessages = msgs as MessageRow[]
      }
    } else {
      // Create new conversation
      const { data: conv, error: convError } = await supabase
        .from("conversations")
        .insert({ status: "active", visitor_id: visitor_id || null })
        .select("id")
        .single()

      if (convError || !conv) {
        throw new Error("Failed to create conversation: " + (convError?.message || "Unknown error"))
      }

      convId = conv.id
    }

    // ── Save user message ──
    await supabase.from("messages").insert({
      conversation_id: convId,
      role: "user",
      content: message,
    })

    // ── Build LLM prompt ──
    const systemPrompt = buildSystemPrompt(kb)

    const llmMessages = [
      { role: "system", content: systemPrompt },
      ...existingMessages.map((m) => ({
        role: m.role === "system" ? "assistant" : m.role,
        content: m.content,
      })),
      { role: "user", content: message },
    ]

    // ── Call LLM ──
    const llmApiKey = Deno.env.get("LLM_API_KEY")
    const llmBaseUrl = Deno.env.get("LLM_BASE_URL") || "https://api.openai.com/v1"
    const llmModel = Deno.env.get("LLM_MODEL") || "gpt-4o-mini"

    if (!llmApiKey) {
      // Abstract mode — return a placeholder response
      const placeholder = parseLLMResponse(
        `Thanks for your message! I'm analyzing your request. Could you tell me a bit more about your budget and timeline so I can see if this is a good fit?\n\`\`\`json\n{"classification":"needs_info","brief":null}\n\`\`\``
      )

      await supabase.from("messages").insert({
        conversation_id: convId,
        role: "assistant",
        content: placeholder.reply,
      })

      return new Response(
        JSON.stringify({
          reply: placeholder.reply,
          classification: placeholder.classification,
          brief: placeholder.brief,
          conversation_id: convId,
        }),
        { headers }
      )
    }

    // ── Actual LLM call ──
    const llmResponse = await fetch(`${llmBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${llmApiKey}`,
      },
      body: JSON.stringify({
        model: llmModel,
        messages: llmMessages,
        max_tokens: 1024,
        temperature: 0.7,
      }),
    })

    if (!llmResponse.ok) {
      const errText = await llmResponse.text()
      throw new Error(`LLM API error (${llmResponse.status}): ${errText}`)
    }

    const llmData = await llmResponse.json()
    const rawReply = llmData.choices?.[0]?.message?.content || ""

    // ── Parse LLM response ──
    const { reply, classification, brief } = parseLLMResponse(rawReply)

    // ── Save assistant message ──
    await supabase.from("messages").insert({
      conversation_id: convId,
      role: "assistant",
      content: reply,
    })

    // ── Update conversation status ──
    if (classification !== "active") {
      await supabase
        .from("conversations")
        .update({ status: classification, updated_at: new Date().toISOString() })
        .eq("id", convId)
    }

    // ── Save brief if qualified ──
    if (classification === "qualified" && brief) {
      await supabase.from("briefs").upsert(
        {
          conversation_id: convId,
          client_contact: brief.client_contact,
          project_type: brief.project_type,
          scope_summary: brief.scope_summary,
          budget: brief.budget,
          timeline: brief.timeline,
          urgency: brief.urgency,
        },
        { onConflict: "conversation_id" }
      )
    }

    return new Response(
      JSON.stringify({
        reply,
        classification,
        brief,
        conversation_id: convId,
      }),
      { headers }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Internal server error",
      }),
      { status: 500, headers }
    )
  }
})