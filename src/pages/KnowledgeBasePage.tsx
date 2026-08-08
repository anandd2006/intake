import { useState, useEffect, type KeyboardEvent } from 'react'
import { supabase } from '../lib/supabase'
import { X, Plus, Save, Loader2, UserRound } from 'lucide-react'
import type { Json } from '../types/database'
import type { ReferralContact } from '../types/features'

function TagInput({
  label,
  values,
  onChange,
  placeholder,
}: {
  label: string
  values: string[]
  onChange: (values: string[]) => void
  placeholder: string
}) {
  const [input, setInput] = useState('')

  const addTag = () => {
    const tag = input.trim()
    if (tag && !values.includes(tag)) {
      onChange([...values, tag])
    }
    setInput('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTag()
    } else if (e.key === 'Backspace' && !input && values.length > 0) {
      onChange(values.slice(0, -1))
    }
  }

  const removeTag = (tag: string) => {
    onChange(values.filter((t) => t !== tag))
  }

  return (
    <div>
      <label className="block text-sm font-medium text-foreground/80 mb-1.5">
        {label}
      </label>
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 transition-colors duration-150 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20">
        {values.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="cursor-pointer rounded-sm p-0.5 text-primary/60 hover:text-primary"
              aria-label={`Remove ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={values.length === 0 ? placeholder : 'Add another…'}
          className="min-w-[120px] flex-1 border-none bg-transparent py-1 text-sm text-foreground placeholder:text-foreground/30 focus:outline-none"
        />
        {input.trim() && (
          <button
            type="button"
            onClick={addTag}
            className="cursor-pointer rounded-md p-1 text-primary hover:bg-primary/10"
            aria-label="Add tag"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}

interface PastProject {
  title: string
  description: string
}

export function KnowledgeBasePage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  const [services, setServices] = useState<string[]>([])
  const [pricingRanges, setPricingRanges] = useState<string[]>([])
  const [availability, setAvailability] = useState('')
  const [outOfScopeRules, setOutOfScopeRules] = useState<string[]>([])
  const [pastProjects, setPastProjects] = useState<PastProject[]>([])
  const [newProjectTitle, setNewProjectTitle] = useState('')
  const [newProjectDescription, setNewProjectDescription] = useState('')
  const [referralContacts, setReferralContacts] = useState<ReferralContact[]>([])
  const [newReferral, setNewReferral] = useState<ReferralContact>({
    name: '',
    service: '',
    contact: '',
  })

  // Convert past projects array to/from JSONB
  const projectsToStrings = (projects: PastProject[]): string[] =>
    projects.map((p) => JSON.stringify(p))

  const stringsToProjects = (strings: string[]): PastProject[] =>
    strings
      .map((s) => {
        try {
          return JSON.parse(s) as PastProject
        } catch {
          return null
        }
      })
      .filter((p): p is PastProject => p !== null)

  useEffect(() => {
    loadKnowledgeBase()
  }, [])

  const loadKnowledgeBase = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('knowledge_base')
      .select('*')
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('Failed to load KB:', error)
    }

    if (data) {
      setServices((data.services as string[]) || [])
      setPricingRanges((data.pricing_ranges as string[]) || [])
      setAvailability(data.availability || '')
      setOutOfScopeRules((data.out_of_scope_rules as string[]) || [])
      setPastProjects(stringsToProjects((data.past_projects as string[]) || []))
      setReferralContacts((data.referral_contacts as ReferralContact[] | null) || [])
    }
    setLoading(false)
  }

  const addProject = () => {
    const title = newProjectTitle.trim()
    const description = newProjectDescription.trim()
    if (title && description) {
      setPastProjects([...pastProjects, { title, description }])
      setNewProjectTitle('')
      setNewProjectDescription('')
    }
  }

  const removeProject = (index: number) => {
    setPastProjects(pastProjects.filter((_, i) => i !== index))
  }

  const save = async () => {
    setSaving(true)
    setMessage(null)

    const payload = {
      services,
      pricing_ranges: pricingRanges,
      availability,
      out_of_scope_rules: outOfScopeRules,
      past_projects: projectsToStrings(pastProjects),
      referral_contacts: referralContacts as unknown as Json,
    }

    // Check if a row exists
    const { data: existing } = await supabase
      .from('knowledge_base')
      .select('id')
      .limit(1)
      .maybeSingle()

    let error: unknown = null

    if (existing) {
      const { error: updateError } = await supabase
        .from('knowledge_base')
        .update(payload)
        .eq('id', existing.id)
      error = updateError
    } else {
      const { error: insertError } = await supabase
        .from('knowledge_base')
        .insert(payload)
      error = insertError
    }

    if (error) {
      setMessage({ type: 'error', text: 'Failed to save. Please try again.' })
    } else {
      setMessage({ type: 'success', text: 'Knowledge base saved!' })
      setTimeout(() => setMessage(null), 3000)
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-heading text-2xl font-semibold text-foreground">
          Knowledge Base
        </h1>
        <p className="mt-1 text-sm text-foreground/60">
          Set the information the AI assistant uses to qualify leads. All fields
          are optional — the assistant will work with what you provide.
        </p>
      </div>

      <div className="space-y-8">
        {/* Services */}
        <section className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <TagInput
            label="Services Offered"
            values={services}
            onChange={setServices}
            placeholder="e.g. Web Design, Branding, UX Audit…"
          />
        </section>

        {/* Pricing Ranges */}
        <section className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <TagInput
            label="Pricing Ranges"
            values={pricingRanges}
            onChange={setPricingRanges}
            placeholder="e.g. $3k–$8k for a landing page…"
          />
        </section>

        {/* Availability */}
        <section className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <div>
            <label className="block text-sm font-medium text-foreground/80 mb-1.5">
              Current Availability
            </label>
            <textarea
              value={availability}
              onChange={(e) => setAvailability(e.target.value)}
              placeholder="e.g. Starting projects in April, 2-week lead time…"
              rows={3}
              className="block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-foreground placeholder:text-foreground/30 transition-colors duration-150 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
            />
          </div>
        </section>

        {/* Out of Scope */}
        <section className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <TagInput
            label="Out of Scope (Services NOT offered)"
            values={outOfScopeRules}
            onChange={setOutOfScopeRules}
            placeholder="e.g. Mobile app development, SEO…"
          />
        </section>

        {/* Past Projects */}
        <section className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <label className="block text-sm font-medium text-foreground/80 mb-1.5">
            Past Projects
          </label>
          <div className="space-y-3">
            {pastProjects.length === 0 && (
              <p className="text-sm text-foreground/40 italic">
                No past projects added. Add examples to help the assistant
                answer "Have you done something like this before?"
              </p>
            )}
            {pastProjects.map((project, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground">
                    {project.title}
                  </div>
                  <div className="mt-0.5 text-xs text-foreground/60 line-clamp-2">
                    {project.description}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeProject(i)}
                  className="mt-0.5 cursor-pointer rounded-md p-1 text-foreground/40 hover:text-destructive"
                  aria-label={`Remove ${project.title}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={newProjectTitle}
                onChange={(e) => setNewProjectTitle(e.target.value)}
                placeholder="Project title"
                className="flex-1 rounded-lg border border-border bg-white px-4 py-2 text-sm text-foreground placeholder:text-foreground/30 transition-colors duration-150 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
              />
              <input
                type="text"
                value={newProjectDescription}
                onChange={(e) => setNewProjectDescription(e.target.value)}
                placeholder="Brief description"
                className="flex-1 rounded-lg border border-border bg-white px-4 py-2 text-sm text-foreground placeholder:text-foreground/30 transition-colors duration-150 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
              />
              <button
                type="button"
                onClick={addProject}
                disabled={!newProjectTitle.trim() || !newProjectDescription.trim()}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-all duration-150 active:scale-[0.97] disabled:opacity-40"
              >
                <Plus className="h-4 w-4" />
                Add
              </button>
            </div>
          </div>
        </section>

        {/* Referral Contacts — grounded out-of-scope suggestions */}
        <section className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <label className="block text-sm font-medium text-foreground/80 mb-1.5">
            Referral Contacts
          </label>
          <p className="mb-3 text-xs text-foreground/50">
            When a lead is out of scope, the assistant suggests ONLY these people
            (never invents one). If nothing matches, it declines gracefully.
          </p>
          <div className="space-y-3">
            {referralContacts.length === 0 && (
              <p className="text-sm text-foreground/40 italic">
                No referrals configured. Out-of-scope leads will be politely
                declined without a suggestion.
              </p>
            )}
            {referralContacts.map((contact, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-lg border border-border bg-white p-3"
              >
                <div className="mt-0.5 shrink-0 text-foreground/40">
                  <UserRound className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-foreground">{contact.name}</div>
                  <div className="mt-0.5 text-xs text-foreground/60">{contact.service}</div>
                  <div className="mt-0.5 text-xs font-medium text-primary">{contact.contact}</div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setReferralContacts(referralContacts.filter((_, idx) => idx !== i))
                  }
                  className="mt-0.5 cursor-pointer rounded-md p-1 text-foreground/40 hover:text-destructive"
                  aria-label={`Remove ${contact.name}`}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            ))}
            <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border bg-muted/30 p-3 sm:flex-row">
              <input
                type="text"
                value={newReferral.name}
                onChange={(e) => setNewReferral({ ...newReferral, name: e.target.value })}
                placeholder="Name"
                className="flex-1 rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground placeholder:text-foreground/30 transition-colors duration-150 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
              />
              <input
                type="text"
                value={newReferral.service}
                onChange={(e) => setNewReferral({ ...newReferral, service: e.target.value })}
                placeholder="Service they cover (e.g. SEO)"
                className="flex-1 rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground placeholder:text-foreground/30 transition-colors duration-150 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
              />
              <input
                type="text"
                value={newReferral.contact}
                onChange={(e) => setNewReferral({ ...newReferral, contact: e.target.value })}
                placeholder="Email or website"
                className="flex-1 rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground placeholder:text-foreground/30 transition-colors duration-150 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
              />
              <button
                type="button"
                onClick={() => {
                  const name = newReferral.name.trim()
                  const service = newReferral.service.trim()
                  const contact = newReferral.contact.trim()
                  if (name && contact) {
                    setReferralContacts([
                      ...referralContacts,
                      { name, service, contact },
                    ])
                    setNewReferral({ name: '', service: '', contact: '' })
                  }
                }}
                disabled={!newReferral.name.trim() || !newReferral.contact.trim()}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-all duration-150 active:scale-[0.97] disabled:opacity-40"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add
              </button>
            </div>
          </div>
        </section>

        {/* Save button and status */}
        <div className="flex items-center gap-4 pt-4 border-t border-border">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:opacity-90 active:scale-[0.97] disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? 'Saving…' : 'Save Knowledge Base'}
          </button>

          {message && (
            <span
              className={`text-sm font-medium ${
                message.type === 'success'
                  ? 'text-green-600'
                  : 'text-destructive'
              }`}
              role={message.type === 'error' ? 'alert' : 'status'}
            >
              {message.text}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}