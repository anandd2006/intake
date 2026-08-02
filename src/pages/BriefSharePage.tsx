import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  Loader2,
  AlertTriangle,
  User,
  Briefcase,
  FileText,
  DollarSign,
  Calendar,
  Clock,
  MessageSquare,
  Sparkles,
  Building2,
  Mail,
} from 'lucide-react'
import { QualificationChecks } from '../components/QualificationChecks'
import { EnrichmentCard } from '../components/EnrichmentCard'
import type { Enrichment, QualificationCheck } from '../types/features'

interface BriefRow {
  client_contact: string
  email: string | null
  company: string | null
  website: string | null
  project_type: string
  scope_summary: string
  budget: string
  timeline: string
  urgency: string
  enrichment: Enrichment | null
  conversation_id: string
  created_at: string
}

const statusConfig: Record<string, { label: string; color: string }> = {
  qualified: { label: 'Qualified', color: 'text-green-600 bg-green-50 border-green-200' },
  needs_info: { label: 'Needs Info', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  out_of_scope: { label: 'Out of Scope', color: 'text-gray-500 bg-gray-50 border-gray-200' },
  active: { label: 'In Progress', color: 'text-blue-600 bg-blue-50 border-blue-200' },
}

/**
 * Public, shareable single-page view of a project brief.
 * Rendered for readability — not a JSON dump. Includes Enrichment and
 * Qualification Checks sections when available.
 */
export function BriefSharePage() {
  const { token } = useParams<{ token: string }>()
  const [brief, setBrief] = useState<BriefRow | null>(null)
  const [checks, setChecks] = useState<QualificationCheck[] | null>(null)
  const [status, setStatus] = useState<string>('active')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setError('No brief link provided')
      setLoading(false)
      return
    }

    const load = async () => {
      const { data: briefData, error: briefError } = await supabase
        .from('briefs')
        .select('*')
        .eq('share_token', token)
        .maybeSingle()

      if (briefError || !briefData) {
        setError('This brief could not be found. It may have been removed.')
        setLoading(false)
        return
      }

      setBrief({
        client_contact: briefData.client_contact,
        email: briefData.email,
        company: briefData.company,
        website: briefData.website,
        project_type: briefData.project_type,
        scope_summary: briefData.scope_summary,
        budget: briefData.budget,
        timeline: briefData.timeline,
        urgency: briefData.urgency,
        enrichment: (briefData.enrichment as Enrichment | null) || null,
        conversation_id: briefData.conversation_id,
        created_at: briefData.created_at,
      })

      const { data: conv } = await supabase
        .from('conversations')
        .select('status, qualification_checks')
        .eq('id', briefData.conversation_id)
        .maybeSingle()

      if (conv) {
        setStatus(conv.status || 'active')
        setChecks((conv.qualification_checks as QualificationCheck[] | null) || null)
      }
      setLoading(false)
    }

    load().catch(() => {
      setError('This brief could not be found. It may have been removed.')
      setLoading(false)
    })
  }, [token])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
      </div>
    )
  }

  if (error || !brief) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-white p-8 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-amber-500" aria-hidden="true" />
          <h1 className="mt-4 font-heading text-lg font-semibold text-foreground">
            Brief not found
          </h1>
          <p className="mt-2 text-sm text-foreground/60">{error}</p>
        </div>
      </div>
    )
  }

  const config = statusConfig[status] || statusConfig.active

  return (
    <div className="min-h-screen bg-background py-10">
      <div className="mx-auto max-w-2xl px-4 sm:px-6">
        {/* Card header */}
        <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
          <div className="border-b border-border bg-primary px-6 py-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Sparkles className="h-5 w-5 text-white" aria-hidden="true" />
                <div>
                  <h1 className="font-heading text-lg font-semibold text-white">
                    Project Brief
                  </h1>
                  <p className="text-xs text-white/70">
                    {new Date(brief.created_at).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              </div>
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${config.color}`}
              >
                {config.label}
              </span>
            </div>
          </div>

          <div className="divide-y divide-border">
            <BriefRowField
              icon={<Briefcase className="h-4 w-4" aria-hidden="true" />}
              label="Project Type"
              value={brief.project_type}
            />
            <BriefRowField
              icon={<FileText className="h-4 w-4" aria-hidden="true" />}
              label="Scope"
              value={brief.scope_summary}
            />
            {brief.client_contact && (
              <BriefRowField
                icon={<User className="h-4 w-4" aria-hidden="true" />}
                label="Contact"
                value={brief.client_contact}
              />
            )}
            {brief.email && (
              <BriefRowField
                icon={<Mail className="h-4 w-4" aria-hidden="true" />}
                label="Email"
                value={brief.email}
              />
            )}
            {brief.company && (
              <BriefRowField
                icon={<Building2 className="h-4 w-4" aria-hidden="true" />}
                label="Company"
                value={brief.company}
              />
            )}
            {brief.website && (
              <BriefRowField
                icon={<MessageSquare className="h-4 w-4" aria-hidden="true" />}
                label="Website"
                value={brief.website}
              />
            )}
            <BriefRowField
              icon={<DollarSign className="h-4 w-4" aria-hidden="true" />}
              label="Budget"
              value={brief.budget}
            />
            <BriefRowField
              icon={<Calendar className="h-4 w-4" aria-hidden="true" />}
              label="Timeline"
              value={brief.timeline}
            />
            <BriefRowField
              icon={<Clock className="h-4 w-4" aria-hidden="true" />}
              label="Urgency"
              value={brief.urgency}
            />
          </div>
        </div>

        {/* Qualification checks */}
        {checks && checks.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-3 font-heading text-base font-semibold text-foreground">
              Qualification Checks
            </h2>
            <div className="rounded-xl border border-border bg-white p-5">
              <QualificationChecks checks={checks} />
            </div>
          </section>
        )}

        {/* Enrichment — omitted gracefully when absent */}
        {brief.enrichment && (
          <section className="mt-6">
            <h2 className="mb-3 font-heading text-base font-semibold text-foreground">
              Company Enrichment
            </h2>
            <EnrichmentCard enrichment={brief.enrichment} />
          </section>
        )}

        <p className="mt-8 text-center text-xs text-foreground/40">
          Shared via Intake Assistant
        </p>
      </div>
    </div>
  )
}

function BriefRowField({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="px-6 py-4">
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
