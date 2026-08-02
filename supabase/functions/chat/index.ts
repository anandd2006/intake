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
  referral_contacts?: ReferralContact[]
}

interface ReferralContact {
  name: string
  service: string
  contact: string
}

interface QualificationCheck {
  check_name: string // "budget_fit" | "timeline_fit" | "scope_match"
  result: "pass" | "fail" | "partial"
  detail: string
}

interface BriefData {
  client_contact: string
  email: string
  company: string
  website: string
  project_type: string
  scope_summary: string
  budget: string
  timeline: string
  urgency: string
}

interface Enrichment {
  company_size: string
  industry: string
  tech_stack: string[]
  public_presence_summary: string
  source_domain: string
  enriched_at: string
}

interface LLMStructuredOutput {
  classification: "qualified" | "needs_info" | "out_of_scope" | "active"
  brief: BriefData | null
  qualification_checks: QualificationCheck[] | null
  referral_suggestion: ReferralContact | null
}

interface MessageRow {
  role: "user" | "assistant" | "system"
  content: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function buildSystemPrompt(kb: KnowledgeBaseRow): string {
  const referrals = Array.isArray(kb.referral_contacts) && kb.referral_contacts.length > 0
    ? kb.referral_contacts.map((r) => `- ${r.name} — ${r.service} (${r.contact})`).join("\n")
    : "None configured. If a project is out of scope, say you don't have a specific referral right now — never invent one."

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

### Referral Contacts (use ONLY these for out-of-scope leads — copy name/contact verbatim)
${referrals}

## Conversation Guidelines
- Be conversational and warm — you're the first impression.
- Do NOT ask questions the visitor has already answered.
- Clarify ONLY: budget range, timeline, project scope details.
- If the project is clearly out of scope (service not offered, budget too low), politely explain why.
  If a referral contact matches the gap, suggest that exact person; otherwise decline gracefully without inventing anyone.
- If you have enough information to classify, do so.
- Keep responses concise but friendly. No markdown formatting.
- At the end of your response, include a JSON block with classification, brief, qualification checks, and referral suggestion.

## Output Format
At the end of your response, include a JSON code block like:
\`\`\`json
{"classification":"needs_info","brief":null,"qualification_checks":null,"referral_suggestion":null}\`\`\`

Classification options:
- "active" — conversation is ongoing, not yet ready to classify
- "qualified" — project is in scope, budget and timeline mentioned, ready for follow-up
- "needs_info" — project seems in scope but need more details (budget, timeline, contact info)
- "out_of_scope" — service not offered or budget clearly below minimum

qualification_checks: REQUIRED whenever classification is NOT "active". Array of at least:
- {"check_name":"budget_fit","result":"pass|fail|partial","detail":"short human-readable reason, e.g. 'Budget ₹15k falls within ₹10k–25k range'"}
- {"check_name":"timeline_fit","result":"pass|fail|partial","detail":"short reason"}
- {"check_name":"scope_match","result":"pass|fail|partial","detail":"short reason"}
Use "pass" (clearly fits), "fail" (clearly doesn't), or "partial" (uncertain / partially fits). Never include a check without a detail string.

brief: include ALL fields when classification is "qualified":
- client_contact: the visitor's name/email if shared
- email: visitor's email if shared, else ""
- company: visitor's company name if shared, else ""
- website: visitor's website URL if shared, else ""
- project_type: what type of project
- scope_summary: 1-2 sentence summary of the work
- budget: stated budget or range
- timeline: stated timeline
- urgency: stated urgency level

referral_suggestion: ONLY for "out_of_scope", pick the single best matching entry from Referral Contacts (copy name/service/contact EXACTLY as listed). null if none matches.`
}

function parseLLMResponse(text: string): {
  reply: string
  classification: string
  brief: BriefData | null
  qualification_checks: QualificationCheck[] | null
  referral_suggestion: ReferralContact | null
} {
  let classification = "active"
  let brief: BriefData | null = null
  let qualification_checks: QualificationCheck[] | null = null
  let referral_suggestion: ReferralContact | null = null

  const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1])
      classification = parsed.classification || "active"

      if (parsed.brief && parsed.brief.project_type) {
        brief = {
          client_contact: parsed.brief.client_contact || "",
          email: parsed.brief.email || "",
          company: parsed.brief.company || "",
          website: parsed.brief.website || "",
          project_type: parsed.brief.project_type || "",
          scope_summary: parsed.brief.scope_summary || "",
          budget: parsed.brief.budget || "",
          timeline: parsed.brief.timeline || "",
          urgency: parsed.brief.urgency || "",
        }
      }

      if (Array.isArray(parsed.qualification_checks) && parsed.qualification_checks.length > 0) {
        qualification_checks = parsed.qualification_checks
          .filter(
            (c: QualificationCheck) =>
              c && typeof c.check_name === "string" && typeof c.detail === "string"
          )
          .map((c: QualificationCheck) => ({
            check_name: c.check_name,
            result: ["pass", "fail", "partial"].includes(c.result) ? c.result : "partial",
            detail: c.detail,
          }))
      }

      if (parsed.referral_suggestion && parsed.referral_suggestion.name) {
        referral_suggestion = {
          name: parsed.referral_suggestion.name,
          service: parsed.referral_suggestion.service || "",
          contact: parsed.referral_suggestion.contact || "",
        }
      }
    } catch {
      // Invalid JSON, ignore
    }
  }

  const reply = text.replace(/```json\n[\s\S]*?\n```/, "").trim()

  return { reply, classification, brief, qualification_checks, referral_suggestion }
}

// ─── Gemini API Helper ────────────────────────────────────────────────────

// Preferred order: newest GA models first; fall back when a model is
// unavailable (404 for new users, 429/503 rate-limit / high demand).
const DEFAULT_GEMINI_MODELS = [
  "gemini-3.5-flash",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
]

async function geminiChat(params: {
  apiKey: string
  model: string
  systemPrompt?: string
  messages: { role: string; content: string }[]
  maxOutputTokens?: number
  temperature?: number
  responseMimeType?: string
}): Promise<string> {
  const {
    apiKey,
    model,
    systemPrompt = "",
    messages,
    maxOutputTokens = 1200,
    temperature = 0.7,
    responseMimeType,
  } = params

  const candidates = model && !DEFAULT_GEMINI_MODELS.includes(model)
    ? [model, ...DEFAULT_GEMINI_MODELS]
    : DEFAULT_GEMINI_MODELS

  // Gemini uses "model" instead of "assistant" for role;
  // system messages are handled via system_instruction, not contents.
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }))

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature,
      maxOutputTokens,
    },
  }

  if (systemPrompt) {
    body.system_instruction = { parts: [{ text: systemPrompt }] }
  }

  if (responseMimeType) {
    (body.generationConfig as Record<string, unknown>).responseMimeType = responseMimeType
  }

  let lastError: Error | null = null

  for (const candidate of candidates) {
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${candidate}:generateContent?key=${apiKey}`

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    if (res.ok) {
      const data = await res.json()
      const text =
        data.candidates?.[0]?.content?.parts
          ?.map((p: { text?: string }) => p.text || "")
          .join("") || ""

      if (text) return text

      const finishReason = data.candidates?.[0]?.finishReason || "UNKNOWN"
      lastError = new Error(`Gemini returned empty response (finishReason: ${finishReason})`)
      continue
    }

    const errText = await res.text()
    lastError = new Error(`Gemini API error (${res.status}): ${errText}`)

    // Only retry on availability / deprecation errors; fail fast on 400s.
    if (![404, 429, 503].includes(res.status)) {
      throw lastError
    }
  }

  throw lastError ?? new Error("Gemini request failed")
}

// ─── Enrichment (Bright Data + Gemini structuring) ────────────────────────

const PERSONAL_EMAIL_DOMAINS = new Set([
  "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "aol.com",
  "icloud.com", "protonmail.com", "proton.me", "live.com", "me.com",
])

function guessTargetUrl(brief: BriefData): string | null {
  let target = (brief.website || "").trim()
  if (!target && brief.email && brief.email.includes("@")) {
    const domain = brief.email.split("@")[1].toLowerCase()
    if (domain && !PERSONAL_EMAIL_DOMAINS.has(domain)) target = domain
  }
  if (!target && brief.company) {
    const slug = brief.company.toLowerCase().replace(/[^a-z0-9]/g, "")
    if (slug.length >= 4) target = `${slug}.com`
  }
  if (!target) return null
  if (!/^https?:\/\//i.test(target)) target = `https://${target}`
  return target
}

async function enrichLead(
  supabase: ReturnType<typeof createClient>,
  briefId: string,
  brief: BriefData,
  apiKey: string,
  model: string
): Promise<Enrichment | null> {
  const target = guessTargetUrl(brief)
  const brightDataKey = Deno.env.get("BRIGHTDATA_API_KEY")
  if (!target || !brightDataKey || !apiKey) return null

  // 1. Fetch the public page through Bright Data Web Unlocker
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 7000)
  let html = ""
  try {
    const res = await fetch("https://api.brightdata.com/request", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${brightDataKey}`,
      },
      body: JSON.stringify({
        zone: "web_unlocker1",
        url: target,
        format: "raw",
        country: "us",
      }),
    })
    if (res.ok) {
      html = (await res.text()).slice(0, 40000)
    }
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }

  if (!html || html.length < 200) return null

  // 2. Extract lightweight signals without a DOM parser
  const title =
    (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").trim().replace(/\s+/g, " ") ||
    null
  const metaDesc =
    (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1] ||
      html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i)?.[1] ||
      "").trim() || null
  const bodyText = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 3500)

  // 3. Ask Gemini to structure the enrichment
  const prompt = `You are a lead-enrichment assistant. Given the homepage content of ${target}, extract structured company intelligence.

Return ONLY a JSON object (no markdown) with this exact shape:
{"company_size":"estimate in words (e.g. '1-10 employees' or 'unknown')","industry":"primary industry","tech_stack":["up to 8 technologies/services visible on the page"],"public_presence_summary":"2-3 sentence summary of what this company publicly appears to be and do, based ONLY on the content"}

If the content is insufficient, use "unknown" for company_size, a best guess or "unknown" for industry, [] for tech_stack, and a short honest summary.

PAGE TITLE: ${title || "unknown"}
META DESCRIPTION: ${metaDesc || "unknown"}
PAGE TEXT:
${bodyText}`

  const raw = await geminiChat({
    apiKey,
    model,
    messages: [{ role: "user", content: prompt }],
    maxOutputTokens: 500,
    temperature: 0.2,
    responseMimeType: "application/json",
  })

  let parsed: Partial<Enrichment> = {}
  try {
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```/g, "").trim()
    parsed = JSON.parse(cleaned)
  } catch {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0])
      } catch {
        return null
      }
    } else {
      return null
    }
  }

  const enrichment: Enrichment = {
    company_size: typeof parsed.company_size === "string" ? parsed.company_size : "unknown",
    industry: typeof parsed.industry === "string" ? parsed.industry : "unknown",
    tech_stack: Array.isArray(parsed.tech_stack)
      ? parsed.tech_stack.filter((t) => typeof t === "string").slice(0, 8)
      : [],
    public_presence_summary:
      typeof parsed.public_presence_summary === "string"
        ? parsed.public_presence_summary
        : "",
    source_domain: new URL(target).hostname.replace(/^www\./, ""),
    enriched_at: new Date().toISOString(),
  }

  await supabase
    .from("briefs")
    .update({ enrichment })
    .eq("id", briefId)

  return enrichment
}

// ─── Main Handler ─────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data: kbData, error: kbError } = await supabase
      .from("knowledge_base")
      .select("*")
      .limit(1)
      .single()

    if (kbError || !kbData) {
      throw new Error("Failed to load knowledge base: " + (kbError?.message || "No KB found"))
    }
    const kb = kbData as unknown as KnowledgeBaseRow

    let convId = conversation_id
    let existingMessages: MessageRow[] = []

    if (convId) {
      const { data: msgs } = await supabase
        .from("messages")
        .select("role, content")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true })

      if (msgs) {
        existingMessages = msgs as MessageRow[]
      }
    } else {
      const { data: conv, error: convError } = await supabase
        .from("conversations")
        .insert({ status: "active", visitor_id: visitor_id || crypto.randomUUID() })
        .select("id")
        .single()

      if (convError || !conv) {
        throw new Error("Failed to create conversation: " + (convError?.message || "Unknown error"))
      }

      convId = conv.id
    }

    await supabase.from("messages").insert({
      conversation_id: convId,
      role: "user",
      content: message,
    })

    const systemPrompt = buildSystemPrompt(kb)

    const llmMessages = [
      { role: "system", content: systemPrompt },
      ...existingMessages.map((m) => ({
        role: m.role === "system" ? "assistant" : m.role,
        content: m.content,
      })),
      { role: "user", content: message },
    ]

    const geminiApiKey = Deno.env.get("GEMINI_API_KEY")
    const geminiModel = Deno.env.get("GEMINI_MODEL") || "gemini-3.5-flash"

    if (!geminiApiKey) {
      const placeholder = parseLLMResponse(
        `Thanks for your message! I'm analyzing your request. Could you tell me a bit more about your budget and timeline so I can see if this is a good fit?\n\`\`\`json\n{"classification":"needs_info","brief":null,"qualification_checks":null,"referral_suggestion":null}\n\`\`\``
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
          qualification_checks: placeholder.qualification_checks,
          referral: placeholder.referral_suggestion,
          enrichment: null,
          conversation_id: convId,
        }),
        { headers }
      )
    }

    const rawReply = await geminiChat({
      apiKey: geminiApiKey,
      model: geminiModel,
      systemPrompt,
      messages: llmMessages,
    })

    const { reply, classification, brief, qualification_checks, referral_suggestion } =
      parseLLMResponse(rawReply)

    await supabase.from("messages").insert({
      conversation_id: convId,
      role: "assistant",
      content: reply,
    })

    // ── Persist conversation state ──
    const convUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (classification !== "active") convUpdate.status = classification
    if (qualification_checks && qualification_checks.length > 0) {
      convUpdate.qualification_checks = qualification_checks
    }
    if (classification === "out_of_scope" && referral_suggestion) {
      convUpdate.referral = referral_suggestion
    }
    await supabase.from("conversations").update(convUpdate).eq("id", convId)

    // ── Save brief if qualified ──
    let savedBriefId: string | null = null
    let enrichment: Enrichment | null = null

    if (classification === "qualified" && brief) {
      const { data: savedBrief } = await supabase
        .from("briefs")
        .upsert(
          {
            conversation_id: convId,
            client_contact: brief.client_contact,
            email: brief.email || null,
            company: brief.company || null,
            website: brief.website || null,
            project_type: brief.project_type,
            scope_summary: brief.scope_summary,
            budget: brief.budget,
            timeline: brief.timeline,
            urgency: brief.urgency,
          },
          { onConflict: "conversation_id" }
        )
        .select("id, enrichment")
        .single()

      if (savedBrief) {
        savedBriefId = savedBrief.id
        // Skip re-enrichment if we already have data
        if (savedBrief.enrichment) {
          enrichment = savedBrief.enrichment as unknown as Enrichment
        }
      }

      // Enrichment runs inline but never blocks a failure — returns null gracefully
      if (savedBriefId && !enrichment) {
        enrichment = await enrichLead(
          supabase,
          savedBriefId,
          brief,
          geminiApiKey,
          geminiModel
        )
      }
    }

    return new Response(
      JSON.stringify({
        reply,
        classification,
        brief,
        qualification_checks,
        referral: referral_suggestion,
        enrichment,
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