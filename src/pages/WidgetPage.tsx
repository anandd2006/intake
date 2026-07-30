import { useState, useRef, useEffect, useCallback } from 'react'
import { MessageSquare, X, Send, Loader2, AlertTriangle, Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { EDGE_FUNCTION_URL, STORAGE_KEYS, CONVERSATION_STATUS } from '../lib/constants'
import type { Tables } from '../types/database'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface EdgeFunctionResponse {
  reply: string
  classification: keyof typeof CONVERSATION_STATUS | 'active'
  brief: {
    client_contact: string
    project_type: string
    scope_summary: string
    budget: string
    timeline: string
    urgency: string
  } | null
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

function classificationMessage(
  classification: string
): { type: 'qualified' | 'out_of_scope' | null; text: string } {
  switch (classification) {
    case 'qualified':
      return {
        type: 'qualified',
        text: "Great news — this looks like a strong fit! I'll compile your brief and the freelancer will be in touch soon.",
      }
    case 'out_of_scope':
      return {
        type: 'out_of_scope',
        text: "This project doesn't quite align with the services offered. I hope you find the right person for it!",
      }
    default:
      return { type: null, text: '' }
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
  const [classificationNotice, setClassificationNotice] = useState<{
    type: 'qualified' | 'out_of_scope'
    text: string
  } | null>(null)
  const [restoring, setRestoring] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const conversationIdRef = useRef<string | null>(getStoredConversationId())
  const visitorIdRef = useRef<string>(getOrCreateVisitorId())

  // ── Restore conversation on mount ──

  useEffect(() => {
    const storedConvId = getStoredConversationId()
    if (!storedConvId) {
      setRestoring(false)
      return
    }

    supabase
      .from('messages')
      .select('role, content, created_at')
      .eq('conversation_id', storedConvId)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (!error && data && data.length > 0) {
          const restored: ChatMessage[] = data.map((m, i) => ({
            id: `restored-${i}`,
            role: m.role as 'user' | 'assistant',
            content: m.content,
          }))
          setMessages([messages[0], ...restored])

          // Check conversation status to show any classification notice
          supabase
            .from('conversations')
            .select('status')
            .eq('id', storedConvId)
            .single()
            .then(({ data: convData }) => {
              if (convData && convData.status !== 'active') {
                const notice = classificationMessage(convData.status)
                if (notice.type) {
                  setClassificationNotice(notice)
                }
              }
              setRestoring(false)
            })
            .catch(() => setRestoring(false))
        } else {
          // No messages found — start fresh
          storeConversationId(null)
          conversationIdRef.current = null
          setRestoring(false)
        }
      })
      .catch(() => setRestoring(false))
  }, [])

  // ── Scroll on new messages ──

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Send message ──

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || sending) return

    // Add user message
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
    }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setSending(true)
    setClassificationNotice(null)

    try {
      // Call the Edge Function
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

      // Store conversation ID for persistence
      conversationIdRef.current = data.conversation_id
      storeConversationId(data.conversation_id)

      // Add assistant reply
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.reply,
      }
      setMessages((prev) => [...prev, assistantMsg])

      // Show classification notice if conversation is resolved
      if (data.classification !== 'active') {
        const notice = classificationMessage(data.classification)
        setClassificationNotice(notice)
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
  }, [input, sending])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // ── Render ──

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3">
      {/* Chat panel */}
      {isOpen && (
        <div className="flex h-[520px] w-[360px] flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border bg-primary px-4 py-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-white" />
              <span className="text-sm font-semibold text-white">
                Intake Assistant
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="cursor-pointer rounded-md p-1 text-white/80 transition-colors hover:text-white"
              aria-label="Close chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {restoring ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-foreground/40" />
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-primary text-white'
                          : 'bg-muted text-foreground'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}

                {/* Classification notice */}
                {classificationNotice && (
                  <div
                    className={`flex items-start gap-2 rounded-xl px-4 py-3 text-sm ${
                      classificationNotice.type === 'qualified'
                        ? 'bg-emerald-50 text-emerald-800'
                        : 'bg-amber-50 text-amber-800'
                    }`}
                  >
                    {classificationNotice.type === 'qualified' ? (
                      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    ) : (
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                    )}
                    <span>{classificationNotice.text}</span>
                  </div>
                )}

                {sending && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl bg-muted px-4 py-2.5">
                      <Loader2 className="h-4 w-4 animate-spin text-foreground/50" />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Tell me about your project…"
                className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-foreground/30 transition-colors duration-150 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                disabled={sending || restoring}
                aria-label="Message input"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || sending || restoring}
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl bg-primary text-white transition-all duration-150 hover:opacity-90 active:scale-[0.97] disabled:opacity-40"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating bubble */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-primary text-white shadow-lg transition-all duration-150 hover:scale-105 active:scale-[0.97]"
          aria-label="Open chat"
        >
          <MessageSquare className="h-6 w-6" />
        </button>
      )}
    </div>
  )
}