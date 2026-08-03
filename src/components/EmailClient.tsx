import { useState, useCallback, useEffect } from 'react'
import {
  Mail,
  Send,
  Copy,
  CheckCheck,
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronRight,
  Check,
  AlertTriangle,
} from 'lucide-react'
import { SEND_EMAIL_URL, EMAIL_DRAFT_URL } from '../lib/constants'
import { useAuth } from '../hooks/useAuth'
import { AnimateIn } from './AnimateIn'

interface BriefSummary {
  client_contact: string
  email: string
  project_type: string
  scope_summary: string
  budget: string
  timeline: string
  urgency: string
}

interface EmailClientProps {
  conversationId: string
  brief: BriefSummary
  emailSentAt: string | null
  onEmailSent: (at: string) => void
}

export function EmailClient({
  conversationId,
  brief,
  emailSentAt,
  onEmailSent,
}: EmailClientProps) {
  const { session } = useAuth()

  const [isOpen, setIsOpen] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [sending, setSending] = useState(false)
  const [copied, setCopied] = useState(false)

  const [to, setTo] = useState(brief.email || '')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')

  const [error, setError] = useState<string | null>(null)

  // ── Generate draft ──

  const generateDraft = useCallback(async () => {
    setGenerating(true)
    setError(null)

    try {
      const res = await fetch(EMAIL_DRAFT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: conversationId,
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => null)
        throw new Error(errData?.error || `Draft generation failed (${res.status})`)
      }

      const data = await res.json()
      if (data.subject) setSubject(data.subject)
      if (data.body) setBody(data.body)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate draft')
    } finally {
      setGenerating(false)
    }
  }, [conversationId])

  // ── Auto-generate on first open ──

  useEffect(() => {
    if (isOpen && !subject && !generating && !emailSentAt) {
      generateDraft()
    }
  }, [isOpen, subject, generating, emailSentAt, generateDraft])

  // ── Send email ──

  const handleSend = useCallback(async () => {
    if (!to.trim() || !subject.trim() || !body.trim()) return
    if (!session?.access_token) {
      setError('You must be signed in to send emails')
      return
    }

    setSending(true)
    setError(null)

    try {
      const res = await fetch(SEND_EMAIL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          to: to.trim(),
          subject: subject.trim(),
          body: body.trim(),
          conversation_id: conversationId,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error || `Send failed (${res.status})`)
      }

      onEmailSent(new Date().toISOString())
      setCopied(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send email')
    } finally {
      setSending(false)
    }
  }, [to, subject, body, conversationId, session, onEmailSent])

  // ── Copy draft ──

  const handleCopy = useCallback(async () => {
    const text = `To: ${to}\nSubject: ${subject}\n\n${body}`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // fallback: select-all copy not available
    }
  }, [to, subject, body])

  const canSend = to.trim() && subject.trim() && body.trim() && !sending && !emailSentAt

  return (
    <div className="mb-4 rounded-xl border border-border bg-white overflow-hidden">
      {/* Header — toggle open/closed */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full cursor-pointer items-center justify-between px-5 py-3.5 transition-colors duration-150 hover:bg-muted/30"
        aria-expanded={isOpen}
        aria-label="Toggle email client"
      >
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-foreground/60" aria-hidden="true" />
          <span className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
            Email Client
          </span>
        </div>
        <div className="flex items-center gap-2">
          {emailSentAt && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
              <Check className="h-3 w-3" aria-hidden="true" />
              Sent
            </span>
          )}
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-foreground/40" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-4 w-4 text-foreground/40" aria-hidden="true" />
          )}
        </div>
      </button>

      {/* Body — collapsed by default */}
      {isOpen && (
        <AnimateIn from="fade" duration={200}>
          <div className="border-t border-border px-5 py-4 space-y-4">
            {/* Success badge */}
            {emailSentAt && (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
                <CheckCheck className="h-4 w-4 shrink-0 text-green-600" aria-hidden="true" />
                <span>
                  Email sent to <strong>{to}</strong> &amp; copy sent to you
                </span>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-destructive/5 px-3 py-2 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            {/* To field */}
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground/60">To</label>
              <input
                type="email"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="client@example.com"
                disabled={sending}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-foreground/30 transition-colors duration-150 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 disabled:opacity-50"
              />
            </div>

            {/* Subject field */}
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground/60">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Following up on your project request"
                disabled={sending}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-foreground/30 transition-colors duration-150 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 disabled:opacity-50"
              />
            </div>

            {/* Body textarea */}
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground/60">Body</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your email here..."
                rows={8}
                disabled={sending}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-foreground/30 transition-colors duration-150 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 disabled:opacity-50 resize-y"
              />
            </div>

            {/* Actions row */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Send */}
              {!emailSentAt && (
                <button
                  onClick={handleSend}
                  disabled={!canSend}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-all duration-150 hover:opacity-90 active:scale-[0.97] disabled:opacity-40"
                >
                  {sending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      Sending…
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" aria-hidden="true" />
                      Send Email
                    </>
                  )}
                </button>
              )}

              {/* Regenerate draft (always visible, disabled while sending) */}
              <button
                onClick={generateDraft}
                disabled={generating || sending}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-foreground/70 transition-all duration-150 hover:border-primary/40 hover:text-primary active:scale-[0.97] disabled:opacity-40"
                title="Regenerate draft"
              >
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                )}
                {generating ? 'Generating…' : 'Draft'}
              </button>

              {/* Copy draft */}
              <button
                onClick={handleCopy}
                disabled={!body.trim() || sending}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-foreground/70 transition-all duration-150 hover:border-primary/40 hover:text-primary active:scale-[0.97] disabled:opacity-40"
                title="Copy draft to clipboard"
              >
                {copied ? (
                  <CheckCheck className="h-4 w-4 text-green-600" aria-hidden="true" />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden="true" />
                )}
                {copied ? 'Copied!' : 'Copy Draft'}
              </button>
            </div>
          </div>
        </AnimateIn>
      )}
    </div>
  )
}