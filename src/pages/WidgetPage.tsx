import { useState, useRef, useEffect, useCallback } from 'react'
import {
  MessageSquare,
  Plus,
  X,
  Send,
  Loader2,
  AlertTriangle,
  Sparkles,
  Mic,
  MicOff,
  FileText,
  Check,
  User,
  Briefcase,
  DollarSign,
  Calendar,
  Clock,
  ExternalLink,
} from 'lucide-react'
import { EDGE_FUNCTION_URL, STORAGE_KEYS } from '../lib/constants'
import { useSpeechInput } from '../hooks/useSpeechInput'
import { EnrichmentCard } from '../components/EnrichmentCard'
import { AnimateIn } from '../components/AnimateIn'
import { animate } from 'animejs'
import type { Enrichment, ReferralContact, WidgetBrief } from '../types/features'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface EdgeFunctionResponse {
  reply: string
  classification: string
  brief: WidgetBrief | null
  qualification_checks: unknown
  referral: ReferralContact | null
  enrichment: Enrichment | null
  conversation_id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getOrCreateVisitorId(): string {
  const existing = localStorage.getItem(STORAGE_KEYS.VISITOR_ID)
  if (existing) return existing
  const newId = crypto.randomUUID()
  localStorage.setItem(STORAGE_KEYS.VISITOR_ID, newId)
  return newId
}

function getStoredConversationId(): string | null {
  return localStorage.getItem(STORAGE_KEYS.CONVERSATION_ID)
}

function storeConversationId(id: string | null) {
  if (id) {
    localStorage.setItem(STORAGE_KEYS.CONVERSATION_ID, id)
  } else {
    localStorage.removeItem(STORAGE_KEYS.CONVERSATION_ID)
  }
}

function classificationNotice(
  classification: string
): { type: 'qualified' | 'out_of_scope'; text: string } | null {
  switch (classification) {
    case 'qualified':
      return {
        type: 'qualified',
        text: "Great news — this looks like a strong fit! Here's the brief I've put together for the freelancer.",
      }
    case 'out_of_scope':
      return {
        type: 'out_of_scope',
        text: "This project doesn't quite align with the services offered. I hope you find the right person for it!",
      }
    default:
      return null
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

export function WidgetPage() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        "Hi there! 👋 I'm the Intake assistant. Tell me about your project and I'll help get things started.",
    },
  ])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [restoring, setRestoring] = useState(true)
  const [notice, setNotice] = useState<{
    type: 'qualified' | 'out_of_scope'
    text: string
  } | null>(null)

  // Feature: brief confirmation + enrichment + referral
  const [briefPanel, setBriefPanel] = useState<WidgetBrief | null>(null)
  const [enrichment, setEnrichment] = useState<Enrichment | null>(null)
  const [referral, setReferral] = useState<ReferralContact | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const msgAnimRef = useRef<HTMLDivElement>(null)
  const prevMsgCount = useRef(0)
  const conversationIdRef = useRef<string | null>(getStoredConversationId())
  const visitorIdRef = useRef<string>(getOrCreateVisitorId())

  // Voice intake — falls back silently to text when unsupported
  const handleTranscript = useCallback((text: string) => {
    setInput(text)
  }, [])
  const { supported: micSupported, listening, start: startListening, stop: stopListening, partialTranscript } =
    useSpeechInput(handleTranscript)

  // ── Restore conversation on mount ──
  // Reads go through the Edge Function (action: "history"), which validates
  // visitor_id ownership server-side — the anon key has no direct table access.

  useEffect(() => {
    const storedConvId = getStoredConversationId()
    if (!storedConvId) {
      setRestoring(false)
      return
    }

    ;(async () => {
      try {
        const response = await fetch(EDGE_FUNCTION_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'history',
            conversation_id: storedConvId,
            visitor_id: visitorIdRef.current,
          }),
        })

        if (!response.ok) throw new Error('history restore failed')

        const data = await response.json()

        if (data && Array.isArray(data.messages) && data.messages.length > 0) {
          const restored: ChatMessage[] = data.messages.map(
            (m: { role: string; content: string }, i: number) => ({
              id: `restored-${i}`,
              role: m.role as 'user' | 'assistant',
              content: m.content,
            })
          )
          setMessages((prev) => [prev[0], ...restored])

          // Restore conversation status + brief + enrichment
          if (data.status && data.status !== 'active') {
            const n = classificationNotice(data.status)
            if (n) setNotice(n)
          }

          if (data.brief) {
            const b = data.brief
            setBriefPanel({
              client_contact: b.client_contact || '',
              email: b.email || '',
              company: b.company || '',
              website: b.website || '',
              project_type: b.project_type || '',
              scope_summary: b.scope_summary || '',
              budget: b.budget || '',
              timeline: b.timeline || '',
              urgency: b.urgency || '',
            })
            setEnrichment((data.enrichment as Enrichment | null) || null)
          }
        } else {
          // No messages found — start fresh
          storeConversationId(null)
          conversationIdRef.current = null
        }
      } catch {
        // Restore failed — fall through to a fresh conversation
      } finally {
        setRestoring(false)
      }
    })()
  }, [])

  // ── Scroll on new messages ──

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Animate newly-appearing messages (anime.js) ──

  useEffect(() => {
    if (restoring || !msgAnimRef.current) return
    const entries = msgAnimRef.current.querySelectorAll<HTMLElement>('[data-msg]')
    const last = entries[entries.length - 1]
    if (!last || entries.length <= prevMsgCount.current) return
    prevMsgCount.current = entries.length

    const anim = animate(last, {
      opacity: [0, 1],
      translateY: ['10px', '0px'],
      duration: 260,
      easing: 'easeOutCubic',
    })
    return () => {
      anim.cancel()
    }
  }, [messages, restoring, isOpen])

  // ── Send message ──

  const handleSend = useCallback(
    async (textOverride?: string) => {
      const text = (textOverride ?? input).trim()
      if (!text || sending) return

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: text,
      }
      setMessages((prev) => [...prev, userMsg])
      setInput('')
      setSending(true)
      setNotice(null)

      try {
        const response = await fetch(EDGE_FUNCTION_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            conversation_id: conversationIdRef.current,
            visitor_id: visitorIdRef.current,
          }),
        })

        if (!response.ok) {
          const errData = await response.json().catch(() => null)
          throw new Error(errData?.error || `Server error (${response.status})`)
        }

        const data: EdgeFunctionResponse = await response.json()

        conversationIdRef.current = data.conversation_id
        storeConversationId(data.conversation_id)

        const assistantMsg: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: data.reply,
        }
        setMessages((prev) => [...prev, assistantMsg])

        // Classification notice + brief confirmation
        if (data.classification !== 'active') {
          const n = classificationNotice(data.classification)
          setNotice(n)
        }
        if (data.classification === 'qualified' && data.brief) {
          setBriefPanel(data.brief)
          setEnrichment(data.enrichment)
        }
        if (data.classification === 'out_of_scope') {
          setReferral(data.referral)
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "We couldn't save that — try again?"
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: 'assistant',
            content: `Sorry, something went wrong: ${errorMessage}`,
          },
        ])
      } finally {
        setSending(false)
      }
    },
    [input, sending]
  )

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleMicClick = async () => {
    if (listening) {
      stopListening()
      return
    }
    const started = await startListening()
    // If voice can't start, the hook has already fallen back silently
    if (started) {
      setInput('')
    }
  }

  // ── Start a brand-new conversation ──
  // Clears the persisted thread so the next message opens a fresh,
  // isolated lead thread in the dashboard.

  const handleNewChat = useCallback(() => {
    if (sending) return

    // Stop any in-progress voice recording
    if (listening) stopListening()

    // 1. Clear the stored conversation_id
    storeConversationId(null)
    conversationIdRef.current = null

    // 2. Reset chat state back to the initial greeting
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content:
          "Hi there! 👋 I'm the Intake assistant. Tell me about your project and I'll help get things started.",
      },
    ])
    setInput('')
    setNotice(null)
    setBriefPanel(null)
    setEnrichment(null)
    setReferral(null)
    prevMsgCount.current = 0
    setRestoring(false)
  }, [sending, listening, stopListening])

  // ── Render ──

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3">
      {/* Chat panel */}
      {isOpen && (
        <AnimateIn from="scale" duration={260} distance="0px">
          <div className="flex h-[560px] w-[380px] flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-primary to-[#0B5E58] px-4 py-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-white" aria-hidden="true" />
              <span className="text-sm font-semibold text-white">
                Intake Assistant
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleNewChat}
                disabled={sending || restoring}
                className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-white/80 transition-colors duration-150 hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-40"
                aria-label="Start a new chat"
                title="Start a new chat"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                New Chat
              </button>
              <span className="h-4 w-px bg-white/20" aria-hidden="true" />
              <button
                onClick={() => setIsOpen(false)}
                className="cursor-pointer rounded-md p-1 text-white/80 transition-colors duration-150 hover:text-white"
                aria-label="Close chat"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {restoring ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-foreground/40" aria-hidden="true" />
              </div>
            ) : (
              <div className="space-y-3" ref={msgAnimRef}>
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    data-msg
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-primary text-white'
                          : 'bg-muted text-foreground'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}

                {/* Live voice transcript while listening */}
                {listening && (
                  <div className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5">
                    <Mic className="mt-0.5 h-4 w-4 shrink-0 animate-pulse text-primary" aria-hidden="true" />
                    <p className="text-sm text-foreground/70 italic">
                      {partialTranscript || 'Listening… speak now'}
                    </p>
                  </div>
                )}

                {/* Classification notice */}
                {notice && (
                  <AnimateIn from="bottom" distance="10px" duration={250}>
                    <div
                      className={`flex items-start gap-2 rounded-xl px-4 py-3 text-sm ${
                        notice.type === 'qualified'
                          ? 'bg-emerald-50 text-emerald-800'
                          : 'bg-amber-50 text-amber-800'
                      }`}
                    >
                      {notice.type === 'qualified' ? (
                        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
                      ) : (
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
                      )}
                      <span>{notice.text}</span>
                    </div>
                  </AnimateIn>
                )}

                {/* Grounded referral for out-of-scope leads */}
                {referral && (
                  <AnimateIn from="bottom" distance="12px" duration={300} delay={80}>
                    <div className="rounded-xl border border-border bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
                      Referral Suggestion
                    </p>
                    <p className="mt-2 text-sm font-medium text-foreground">{referral.name}</p>
                    <p className="text-xs text-foreground/60">{referral.service}</p>
                    <a
                      href={referral.contact.startsWith('http') ? referral.contact : `mailto:${referral.contact}`}
                      target={referral.contact.startsWith('http') ? '_blank' : undefined}
                      rel="noreferrer"
                      className="mt-1.5 inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-primary hover:text-primary/80"
                    >
                      {referral.contact}
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </a>
                  </div>
                  </AnimateIn>
                )}

                {/* Visitor-facing brief confirmation */}
                {briefPanel && (
                  <AnimateIn from="bottom" distance="14px" duration={350} delay={120}>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <FileText className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                        <p className="text-sm font-semibold text-emerald-900">Your Brief</p>
                      </div>
                      <button
                        onClick={() => setBriefPanel(null)}
                        className="cursor-pointer rounded-md p-1 text-emerald-700/60 transition-colors duration-150 hover:text-emerald-900"
                        aria-label="Dismiss brief"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>

                    <dl className="space-y-2 text-sm">
                      {briefPanel.client_contact && (
                        <div className="flex items-start gap-2">
                          <User className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
                          <dd className="text-emerald-900">{briefPanel.client_contact}</dd>
                        </div>
                      )}
                      <div className="flex items-start gap-2">
                        <Briefcase className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
                        <dd className="text-emerald-900">{briefPanel.project_type}</dd>
                      </div>
                      <div className="flex items-start gap-2">
                        <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
                        <dd className="text-emerald-800/90">{briefPanel.scope_summary}</dd>
                      </div>
                      {briefPanel.budget && (
                        <div className="flex items-start gap-2">
                          <DollarSign className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
                          <dd className="text-emerald-900">{briefPanel.budget}</dd>
                        </div>
                      )}
                      {briefPanel.timeline && (
                        <div className="flex items-start gap-2">
                          <Calendar className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
                          <dd className="text-emerald-900">{briefPanel.timeline}</dd>
                        </div>
                      )}
                      {briefPanel.urgency && (
                        <div className="flex items-start gap-2">
                          <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
                          <dd className="text-emerald-900">{briefPanel.urgency}</dd>
                        </div>
                      )}
                    </dl>

                    {/* Enrichment — omitted gracefully when absent */}
                    {enrichment && (
                      <div className="mt-3">
                        <EnrichmentCard enrichment={enrichment} variant="widget" />
                      </div>
                    )}

                    <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-700">
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      Shared with the freelancer — they'll reach out shortly.
                    </div>
                  </div>
                  </AnimateIn>
                )}

                {sending && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl bg-muted px-4 py-2.5">
                      <Loader2 className="h-4 w-4 animate-spin text-foreground/50" aria-hidden="true" />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-border px-4 py-3">
            {listening && (
              <div className="mb-2 flex items-center justify-between rounded-lg bg-primary/5 px-3 py-1.5 text-xs text-primary">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                  Recording — press stop when done
                </span>
                <button
                  onClick={stopListening}
                  className="cursor-pointer font-medium underline-offset-2 hover:underline"
                >
                  Stop
                </button>
              </div>
            )}
            <div className="flex items-center gap-2">
              {micSupported && !listening && (
                <button
                  onClick={handleMicClick}
                  disabled={sending || restoring}
                  className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-border bg-white text-foreground/60 transition-all duration-150 hover:border-primary/40 hover:text-primary active:scale-[0.97] disabled:opacity-40"
                  aria-label="Speak instead of type"
                  title="Speak instead of type"
                >
                  <Mic className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
              {micSupported && listening && (
                <button
                  onClick={stopListening}
                  className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-destructive text-white transition-all duration-150 active:scale-[0.97]"
                  aria-label="Stop recording"
                  aria-pressed="true"
                >
                  <MicOff className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={listening ? 'Speaking…' : 'Tell me about your project…'}
                className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-foreground/30 transition-colors duration-150 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                disabled={sending || restoring}
                aria-label="Message input"
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || sending || restoring}
                className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-primary text-white transition-all duration-150 hover:opacity-90 active:scale-[0.97] disabled:opacity-40"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
        </AnimateIn>
      )}

      {/* Floating bubble */}
      {!isOpen && (
        <div className="relative">
          {/* Pulsing ring */}
          <div
            className="absolute -inset-2 rounded-full border-2 border-primary/40 animate-ping"
            aria-hidden="true"
            style={{ animationDuration: '2.5s' }}
          />
          <button
            onClick={() => setIsOpen(true)}
            className="relative flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-gradient-to-br from-primary to-[#0B5E58] text-white shadow-lg transition-all duration-150 hover:scale-110 active:scale-[0.97]"
            aria-label="Open chat"
          >
            <MessageSquare className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  )
}
