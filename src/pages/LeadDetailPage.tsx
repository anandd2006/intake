import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  ArrowLeft,
  Check,
  Archive,
  MessageSquare,
  User,
  Calendar,
  DollarSign,
  Clock,
  AlertTriangle,
  Briefcase,
  FileText,
  Share2,
  CheckCheck,
  ExternalLink,
  Mail,
  Building2,
  Globe,
} from 'lucide-react'
import { QualificationChecks } from '../components/QualificationChecks'
import { EnrichmentCard } from '../components/EnrichmentCard'
import { EmailClient } from '../components/EmailClient'
import type { Enrichment, QualificationCheck, ReferralContact } from '../types/features'

interface Brief {
  client_contact: string
  email: string
  company: string
  website: string
  project_type: string
  scope_summary: string
  budget: string
  timeline: string
  urgency: string
  enrichment: Enrichment | null
  share_token: string | null
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

interface LeadDetail {
  id: string
  status: string
  created_at: string
  updated_at: string
  email_sent_at: string | null
  visitor_id: string
  qualification_checks: QualificationCheck[] | null
  referral: ReferralContact | null
  brief: Brief | null
  messages: Message[]
}

const statusConfig: Record<string, { label: string; text: string; dot: string }> = {
  qualified: { label: 'Qualified', text: 'text-emerald-600', dot: 'bg-emerald-500' },
  needs_info: { label: 'Needs Info', text: 'text-amber-600', dot: 'bg-amber-500' },
  out_of_scope: { label: 'Out of Scope', text: 'text-foreground/50', dot: 'bg-foreground/40' },
  active: { label: 'In Progress', text: 'text-primary', dot: 'bg-primary' },
  archived: { label: 'Archived', text: 'text-foreground/40', dot: 'bg-foreground/30' },
}

export function LeadDetailPage() {
  const { id } = useParams<{ id: string }>()

  const [lead, setLead] = useState<LeadDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (id) loadLead(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const loadLead = async (leadId: string) => {
    setLoading(true)
    setError(null)

    try {
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', leadId)
        .single()

      if (convError || !conversation) throw new Error('Lead not found')

      const { data: messages, error: msgError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', leadId)
        .order('created_at', { ascending: true })

      if (msgError) throw msgError

      const { data: brief } = await supabase
        .from('briefs')
        .select('*')
        .eq('conversation_id', leadId)
        .maybeSingle()

      setLead({
        id: conversation.id,
        status: conversation.status,
        created_at: conversation.created_at,
        updated_at: conversation.updated_at,
        email_sent_at: conversation.email_sent_at || null,
        visitor_id: conversation.visitor_id,
        qualification_checks: (conversation.qualification_checks as QualificationCheck[] | null) || null,
        referral: (conversation.referral as ReferralContact | null) || null,
        messages: (messages || []) as Message[],
        brief: brief
          ? {
              client_contact: brief.client_contact,
              email: brief.email || '',
              company: brief.company || '',
              website: brief.website || '',
              project_type: brief.project_type,
              scope_summary: brief.scope_summary,
              budget: brief.budget,
              timeline: brief.timeline,
              urgency: brief.urgency,
              enrichment: (brief.enrichment as Enrichment | null) || null,
              share_token: brief.share_token || null,
            }
          : null,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load lead')
    } finally {
      setLoading(false)
    }
  }

  const updateStatus = async (newStatus: string) => {
    if (!id) return
    setActionLoading(true)

    const { error: updateError } = await supabase
      .from('conversations')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (updateError) {
      setError('Failed to update lead status')
    } else {
      setLead((prev) => (prev ? { ...prev, status: newStatus } : null))
    }
    setActionLoading(false)
  }

  const copyShareLink = async () => {
    if (!lead?.brief?.share_token) return
    const url = `${window.location.origin}/brief/${lead.brief.share_token}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard unavailable — ignore */
    }
  }

  const handleEmailSent = (at: string) => {
    setLead((prev) => (prev ? { ...prev, email_sent_at: at } : null))
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 h-5 w-28">
          <div className="skeleton h-5 w-28" />
        </div>
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="space-y-4">
            <div className="skeleton h-9 w-56" />
            <div className="skeleton h-[420px] w-full" />
          </div>
          <div className="space-y-4">
            <div className="skeleton h-[300px] w-full" />
            <div className="skeleton h-64 w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !lead) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <Link
          to="/dashboard/leads"
          className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-foreground/60 transition-colors duration-150 hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to leads
        </Link>
        <div className="mt-8 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error || 'Lead not found'}
        </div>
      </div>
    )
  }

  const config = statusConfig[lead.status] || statusConfig.active

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Back link + actions */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <Link
          to="/dashboard/leads"
          className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-foreground/60 transition-colors duration-150 hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to leads
        </Link>

        <div className="flex items-center gap-2">
          {lead.brief?.share_token && (
            <button
              onClick={copyShareLink}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-foreground/70 transition-all duration-150 hover:border-primary/40 hover:text-primary active:scale-[0.97]"
              aria-label="Copy shareable brief link"
            >
              {copied ? (
                <CheckCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
              ) : (
                <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {copied ? 'Link copied!' : 'Copy share link'}
            </button>
          )}
          <button
            onClick={() => updateStatus('qualified')}
            disabled={actionLoading || lead.status === 'qualified'}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white transition-all duration-150 hover:opacity-90 active:scale-[0.97] disabled:opacity-40"
          >
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            Mark Handled
          </button>
          <button
            onClick={() => updateStatus('archived')}
            disabled={actionLoading || lead.status === 'archived'}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-foreground/70 transition-all duration-150 hover:bg-muted hover:text-foreground active:scale-[0.97] disabled:opacity-40"
          >
            <Archive className="h-3.5 w-3.5" aria-hidden="true" />
            Archive
          </button>
        </div>
      </div>

      {actionLoading && (
        <div className="mb-4 flex items-center gap-2 text-xs text-primary">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden="true" />
          Updating…
        </div>
      )}

      {/* Header row: lead identity + status */}
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">
            {lead.brief?.client_contact || 'Anonymous visitor'}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-foreground/50">
            {lead.brief?.project_type && (
              <span className="inline-flex items-center gap-1.5">
                <Briefcase className="h-3.5 w-3.5" aria-hidden="true" />
                {lead.brief.project_type}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
              {new Date(lead.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
              {lead.messages.length} message{lead.messages.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Status — mono, dot indicator */}
        <span className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-1.5">
          <span className={`h-2 w-2 rounded-full ${config.dot}`} aria-hidden="true" />
          <span className={`font-mono text-xs font-semibold uppercase tracking-wider ${config.text}`}>
            {config.label}
          </span>
        </span>
      </div>

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Left: Qualification (centerpiece) + Chat transcript */}
        <div>
          {/* Qualification reasoning — the signature element */}
          <section className="mb-6">
            <h2 className="mb-3 font-heading text-base font-semibold text-foreground">
              Qualification
            </h2>
            {lead.qualification_checks && lead.qualification_checks.length > 0 ? (
              <QualificationChecks checks={lead.qualification_checks} />
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-white px-5 py-4 text-sm text-foreground/50">
                {lead.status === 'active'
                  ? 'This conversation is still in progress — checks appear once the lead is classified.'
                  : 'No qualification checks were recorded for this lead.'}
              </div>
            )}
          </section>

          {/* Chat transcript */}
          <section>
            <h2 className="mb-3 font-heading text-base font-semibold text-foreground">
              Conversation
            </h2>

            <div className="overflow-hidden rounded-xl border border-border bg-white">
              {/* Messages */}
              <div className="max-h-[560px] space-y-4 overflow-y-auto px-5 py-4">
                {lead.messages.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-center">
                    <MessageSquare className="mb-2 h-6 w-6 text-foreground/20" aria-hidden="true" />
                    <p className="text-sm text-foreground/40">No messages in this lead</p>
                  </div>
                ) : (
                  lead.messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex items-end gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      {msg.role === 'assistant' && (
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground text-[10px] font-semibold text-white">
                          AI
                        </div>
                      )}
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-primary text-white rounded-br-md'
                            : 'bg-muted text-foreground rounded-bl-md'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                        <p
                          className={`mt-1 text-xs ${
                            msg.role === 'user' ? 'text-white/60' : 'text-foreground/40'
                          }`}
                        >
                          {new Date(msg.created_at).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      {msg.role === 'user' && (
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-white">
                          U
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        </div>

        {/* Right: Lead details */}
        <div>
          {/* Brief */}
          {lead.brief ? (
            <div className="mb-4 overflow-hidden rounded-xl border border-border bg-white">
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
                  Project Brief
                </p>
                {lead.brief.share_token && (
                  <a
                    href={`/brief/${lead.brief.share_token}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-primary transition-colors duration-150 hover:text-primary/80"
                  >
                    Open
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                )}
              </div>

              <div className="divide-y divide-border">
                <BriefField
                  icon={<User className="h-4 w-4" aria-hidden="true" />}
                  label="Contact"
                  value={lead.brief.client_contact}
                />
                {lead.brief.email && (
                  <BriefField
                    icon={<Mail className="h-4 w-4" aria-hidden="true" />}
                    label="Email"
                    value={lead.brief.email}
                  />
                )}
                {lead.brief.company && (
                  <BriefField
                    icon={<Building2 className="h-4 w-4" aria-hidden="true" />}
                    label="Company"
                    value={lead.brief.company}
                  />
                )}
                {lead.brief.website && (
                  <BriefField
                    icon={<Globe className="h-4 w-4" aria-hidden="true" />}
                    label="Website"
                    value={lead.brief.website}
                  />
                )}
                <BriefField
                  icon={<Briefcase className="h-4 w-4" aria-hidden="true" />}
                  label="Project Type"
                  value={lead.brief.project_type}
                />
                <BriefField
                  icon={<FileText className="h-4 w-4" aria-hidden="true" />}
                  label="Scope"
                  value={lead.brief.scope_summary}
                />
                <BriefField
                  icon={<DollarSign className="h-4 w-4" aria-hidden="true" />}
                  label="Budget"
                  value={lead.brief.budget}
                />
                <BriefField
                  icon={<Calendar className="h-4 w-4" aria-hidden="true" />}
                  label="Timeline"
                  value={lead.brief.timeline}
                />
                <BriefField
                  icon={<Clock className="h-4 w-4" aria-hidden="true" />}
                  label="Urgency"
                  value={lead.brief.urgency}
                />
              </div>

              {/* Distinct Enrichment section — omitted gracefully when absent */}
              {lead.brief.enrichment && (
                <div className="mt-4">
                  <EnrichmentCard enrichment={lead.brief.enrichment} />
                </div>
              )}
            </div>
          ) : (
            <div className="mb-4 rounded-xl border border-border bg-white p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium text-foreground">No brief available</p>
                  <p className="mt-1 text-xs text-foreground/50">
                    {lead.status === 'active' || lead.status === 'needs_info'
                      ? 'The conversation is still in progress. A brief will be generated once the lead is qualified.'
                      : lead.status === 'out_of_scope'
                      ? 'This lead was classified as out of scope, so no brief was generated.'
                      : 'No brief data was captured for this lead.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Referral for out-of-scope */}
          {lead.referral && (
            <div className="mb-4 rounded-xl border border-border bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
                Referral Suggested
              </p>
              <p className="mt-2 text-sm font-medium text-foreground">{lead.referral.name}</p>
              <p className="text-xs text-foreground/60">{lead.referral.service}</p>
              {lead.referral.contact && (
                <a
                  href={
                    lead.referral.contact.startsWith('http')
                      ? lead.referral.contact
                      : `mailto:${lead.referral.contact}`
                  }
                  target={lead.referral.contact.startsWith('http') ? '_blank' : undefined}
                  rel="noreferrer"
                  className="mt-1.5 inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-primary transition-colors duration-150 hover:text-primary/80"
                >
                  {lead.referral.contact}
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              )}
            </div>
          )}

          {/* Email Client — follow-up draft + send (qualified / needs_info only) */}
          {lead.brief &&
            lead.brief.email &&
            (lead.status === 'qualified' || lead.status === 'needs_info') && (
              <EmailClient
                conversationId={lead.id}
                brief={{
                  client_contact: lead.brief.client_contact,
                  email: lead.brief.email,
                  project_type: lead.brief.project_type,
                  scope_summary: lead.brief.scope_summary,
                  budget: lead.brief.budget,
                  timeline: lead.brief.timeline,
                  urgency: lead.brief.urgency,
                }}
                emailSentAt={lead.email_sent_at}
                onEmailSent={handleEmailSent}
              />
            )}

          {/* Visitor info — mono */}
          <div className="rounded-xl border border-border bg-white p-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-foreground/50">
              Visitor ID
            </p>
            <p className="truncate font-mono text-sm text-foreground">
              {lead.visitor_id || 'N/A'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function BriefField({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="px-5 py-3.5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0 text-foreground/40">{icon}</div>
        <div className="min-w-0">
          <p className="text-xs text-foreground/50">{label}</p>
          <p className="mt-0.5 text-sm text-foreground">{value || 'Not specified'}</p>
        </div>
      </div>
    </div>
  )
}
