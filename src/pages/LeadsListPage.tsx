import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'
import {
  Loader2,
  ChevronUp,
  ChevronDown,
  Check,
  Archive,
  MessageSquare,
  Search,
  X,
} from 'lucide-react'
import { useAnimeStagger } from '../hooks/useAnime'

type StatusFilter = 'all' | 'qualified' | 'needs_info' | 'out_of_scope' | 'active'
type SortField = 'created_at' | 'status'
type SortDir = 'asc' | 'desc'

interface LeadRow {
  id: string
  status: string
  created_at: string
  client_contact: string | null
  project_type: string | null
}

const statusConfig: Record<string, { label: string; color: string }> = {
  qualified: { label: 'Qualified', color: 'text-green-600 bg-green-50 border-green-200' },
  needs_info: { label: 'Needs Info', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  out_of_scope: { label: 'Out of Scope', color: 'text-gray-500 bg-gray-50 border-gray-200' },
  active: { label: 'In Progress', color: 'text-blue-600 bg-blue-50 border-blue-200' },
}

const filterOptions: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'needs_info', label: 'Needs Info' },
  { value: 'out_of_scope', label: 'Out of Scope' },
  { value: 'active', label: 'In Progress' },
]

export function LeadsListPage() {
  const [leads, setLeads] = useState<LeadRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [searchQuery, setSearchQuery] = useState('')

  // anime.js — stagger rows on initial load
  const rowsRef = useAnimeStagger<HTMLDivElement>([loading, leads.length], { staggerBy: 40, duration: 280, from: 'fade' })

  useEffect(() => {
    loadLeads()
  }, [statusFilter, sortField, sortDir])

  const loadLeads = async () => {
    setLoading(true)
    setError(null)

    try {
      let query = supabase.from('conversations').select('id, status, created_at')

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      query = query.order(sortField, { ascending: sortDir === 'asc' })

      const { data: conversations, error: convError } = await query

      if (convError) throw convError

      // Fetch briefs for contact info
      const convIds = (conversations || []).map((c) => c.id)
      const { data: briefs } = await supabase
        .from('briefs')
        .select('conversation_id, client_contact, project_type')
        .in('conversation_id', convIds.length > 0 ? convIds : ['none'])

      const briefMap = new Map(
        (briefs || []).map((b) => [b.conversation_id, b])
      )

      const rows: LeadRow[] = (conversations || []).map((c) => {
        const brief = briefMap.get(c.id)
        return {
          id: c.id,
          status: c.status,
          created_at: c.created_at,
          client_contact: brief?.client_contact || null,
          project_type: brief?.project_type || null,
        }
      })

      setLeads(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leads')
    } finally {
      setLoading(false)
    }
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  const handleMarkHandled = async (id: string) => {
    const { error } = await supabase
      .from('conversations')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', id)

    if (!error) {
      setLeads((prev) => prev.filter((l) => l.id !== id))
    }
  }

  const handleArchive = async (id: string) => {
    const { error } = await supabase
      .from('conversations')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', id)

    if (!error) {
      setLeads((prev) => prev.filter((l) => l.id !== id))
    }
  }

  // Search filter for the loaded data (client-side)
  const filteredLeads = leads.filter((lead) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      (lead.client_contact && lead.client_contact.toLowerCase().includes(q)) ||
      (lead.project_type && lead.project_type.toLowerCase().includes(q))
    )
  })

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-semibold text-foreground">
          Leads
        </h1>
        <p className="mt-1 text-sm text-foreground/60">
          Review and manage incoming leads from the chat widget
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">
          {error}
        </div>
      )}

      {/* Filters bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* Status filter pills */}
        <div className="flex flex-wrap gap-1.5">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setStatusFilter(option.value)}
              className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
                statusFilter === option.value
                  ? 'border-primary bg-primary text-white'
                  : 'border-border bg-white text-foreground/60 hover:border-foreground/20 hover:text-foreground'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative ml-auto w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/30" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or project…"
            className="block w-full rounded-lg border border-border bg-white py-2 pl-9 pr-8 text-sm text-foreground placeholder:text-foreground/30 transition-colors duration-150 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded p-0.5 text-foreground/30 hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex h-48 items-center justify-center rounded-xl border border-border bg-white">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filteredLeads.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-white px-6 py-16 text-center">
          <MessageSquare className="mb-3 h-10 w-10 text-foreground/20" />
          <p className="text-sm font-medium text-foreground/60">
            {searchQuery || statusFilter !== 'all'
              ? 'No leads match your filters'
              : 'No leads yet'}
          </p>
          <p className="mt-1 text-xs text-foreground/40">
            {searchQuery || statusFilter !== 'all'
              ? 'Try adjusting your search or filter'
              : 'Leads will appear once visitors start chatting with the widget'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-white">
          {/* Table header */}
          <div className="hidden sm:grid sm:grid-cols-[1fr_1.5fr_auto_auto] gap-4 border-b border-border bg-muted/50 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-foreground/50">
            <button
              onClick={() => handleSort('created_at')}
              className="flex cursor-pointer items-center gap-1 text-left transition-colors duration-150 hover:text-foreground"
            >
              Date
              {sortField === 'created_at' && (
                sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
              )}
            </button>
            <span>Contact / Project</span>
            <button
              onClick={() => handleSort('status')}
              className="flex cursor-pointer items-center gap-1 text-left transition-colors duration-150 hover:text-foreground"
            >
              Status
              {sortField === 'status' && (
                sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
              )}
            </button>
            <span className="sr-only">Actions</span>
          </div>

          {/* Table rows */}
          <div ref={rowsRef} className="divide-y divide-border">
            {filteredLeads.map((lead) => {
              const config = statusConfig[lead.status] || statusConfig.active
              const date = new Date(lead.created_at)
              const dateStr = date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })

              return (
                <div
                  key={lead.id}
                  className="group grid grid-cols-1 sm:grid-cols-[1fr_1.5fr_auto_auto] gap-3 sm:gap-4 px-5 py-3.5 items-start sm:items-center transition-colors duration-150 hover:bg-muted/30"
                >
                  {/* Date - desktop */}
                  <span className="hidden sm:block text-sm text-foreground/60">
                    {dateStr}
                  </span>

                  {/* Mobile card-style layout */}
                  <div className="sm:hidden flex items-center justify-between">
                    <span className="text-xs text-foreground/50">{dateStr}</span>
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${config.color}`}
                    >
                      {config.label}
                    </span>
                  </div>

                  {/* Contact / Project */}
                  <Link
                    to={`/dashboard/leads/${lead.id}`}
                    className="min-w-0 cursor-pointer"
                  >
                    <div className="text-sm font-medium text-foreground truncate">
                      {lead.client_contact || 'Anonymous visitor'}
                    </div>
                    {lead.project_type && (
                      <div className="text-xs text-foreground/40 truncate mt-0.5">
                        {lead.project_type}
                      </div>
                    )}
                  </Link>

                  {/* Status - desktop */}
                  <span
                    className={`hidden sm:inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${config.color}`}
                  >
                    {config.label}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <Link
                      to={`/dashboard/leads/${lead.id}`}
                      className="inline-flex sm:hidden cursor-pointer items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-primary transition-colors duration-150 hover:bg-primary/10"
                    >
                      View
                    </Link>
                    <button
                      onClick={() => handleMarkHandled(lead.id)}
                      className="cursor-pointer rounded-md p-1.5 text-foreground/40 opacity-0 group-hover:opacity-100 transition-all duration-150 hover:bg-green-50 hover:text-green-600 focus:opacity-100"
                      aria-label="Mark as handled"
                      title="Mark as handled"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleArchive(lead.id)}
                      className="cursor-pointer rounded-md p-1.5 text-foreground/40 opacity-0 group-hover:opacity-100 transition-all duration-150 hover:bg-muted hover:text-foreground focus:opacity-100"
                      aria-label="Archive lead"
                      title="Archive"
                    >
                      <Archive className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Result count */}
      {!loading && (
        <p className="mt-3 text-xs text-foreground/40">
          Showing {filteredLeads.length} of {leads.length} lead{leads.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  )
}