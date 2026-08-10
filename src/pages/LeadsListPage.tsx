import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'
import {
  ChevronUp,
  ChevronDown,
  Check,
  Archive,
  MessageSquare,
  Search,
  X,
  ArrowRight,
  Trash2,
  RotateCcw,
  Square,
  SquareCheck,
  AlertTriangle,
} from 'lucide-react'

type StatusFilter = 'all' | 'qualified' | 'needs_info' | 'out_of_scope' | 'active' | 'archived'
type SortField = 'created_at' | 'status'
type SortDir = 'asc' | 'desc'

interface LeadRow {
  id: string
  status: string
  created_at: string
  client_contact: string | null
  project_type: string | null
}

const statusConfig: Record<string, { label: string; text: string; dot: string }> = {
  qualified: { label: 'Qualified', text: 'text-emerald-600', dot: 'bg-emerald-500' },
  needs_info: { label: 'Needs Info', text: 'text-amber-600', dot: 'bg-amber-500' },
  out_of_scope: { label: 'Out of Scope', text: 'text-foreground/50', dot: 'bg-foreground/40' },
  active: { label: 'In Progress', text: 'text-primary', dot: 'bg-primary' },
  archived: { label: 'Archived', text: 'text-foreground/40', dot: 'bg-foreground/30' },
}

const filterOptions: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'needs_info', label: 'Needs Info' },
  { value: 'out_of_scope', label: 'Out of Scope' },
  { value: 'active', label: 'In Progress' },
  { value: 'archived', label: 'Archived' },
]

function TableSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white">
      <div className="flex items-center gap-4 border-b border-border bg-muted/50 px-5 py-3">
        <div className="skeleton h-4 w-4" />
        <div className="skeleton h-3 w-16" />
        <div className="skeleton h-3 w-24" />
        <div className="skeleton ml-auto h-3 w-14" />
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4">
            <div className="skeleton h-4 w-4" />
            <div className="skeleton h-4 w-24" />
            <div className="skeleton h-4 w-40" />
            <div className="skeleton ml-auto h-5 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  variant,
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  variant: 'danger' | 'default'
  loading: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 backdrop-blur-sm"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-border bg-white p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          {variant === 'danger' && (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden="true" />
            </div>
          )}
          <div>
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <p className="mt-1 text-sm text-foreground/60">{message}</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2.5">
          <button
            onClick={onCancel}
            disabled={loading}
            className="cursor-pointer rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-foreground/70 transition-all duration-150 hover:bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold text-white transition-all duration-150 active:scale-[0.97] disabled:opacity-50 ${
              variant === 'danger'
                ? 'bg-destructive hover:bg-destructive/90'
                : 'bg-primary hover:opacity-90'
            }`}
          >
            {loading ? 'Please wait…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export function LeadsListPage() {
  const [leads, setLeads] = useState<LeadRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [actionLoading, setActionLoading] = useState(false)

  // Confirmation dialog state
  const [confirm, setConfirm] = useState<{
    type: 'delete' | 'archive' | 'restore'
    ids: string[]
    title: string
    message: string
  } | null>(null)

  useEffect(() => {
    loadLeads()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      const convs = conversations || []

      // Fetch briefs for contact info
      const convIds = convs.map((c) => c.id)
      const { data: briefs } = await supabase
        .from('briefs')
        .select('conversation_id, client_contact, project_type')
        .in('conversation_id', convIds.length > 0 ? convIds : ['none'])

      const briefMap = new Map(
        (briefs || []).map((b) => [b.conversation_id, b])
      )

      const rows: LeadRow[] = convs.map((c) => {
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
      // Clear selection when data reloads
      setSelectedIds(new Set())
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

  // ── Selection ──

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredLeads.length && filteredLeads.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredLeads.map((l) => l.id)))
    }
  }

  // ── Single actions ──

  const handleArchiveSingle = async (id: string) => {
    const { error } = await supabase
      .from('conversations')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', id)

    if (!error) {
      if (statusFilter === 'archived') {
        // If viewing archived, remove from local list
        setLeads((prev) => prev.filter((l) => l.id !== id))
      } else {
        // Otherwise just update the status locally so it reflects
        setLeads((prev) =>
          prev.map((l) => (l.id === id ? { ...l, status: 'archived' } : l))
        )
      }
    }
  }

  const handleDeleteSingle = async (id: string) => {
    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', id)

    if (!error) {
      setLeads((prev) => prev.filter((l) => l.id !== id))
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  const handleRestoreSingle = async (id: string) => {
    const { error } = await supabase
      .from('conversations')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('id', id)

    if (!error) {
      setLeads((prev) => prev.filter((l) => l.id !== id))
    }
  }

  // ── Bulk actions ──

  const executeBulkAction = useCallback(async () => {
    if (!confirm) return
    setActionLoading(true)
    const { type, ids } = confirm

    try {
      if (type === 'delete') {
        const { error: delErr } = await supabase
          .from('conversations')
          .delete()
          .in('id', ids)
        if (delErr) throw delErr
        setLeads((prev) => prev.filter((l) => !ids.includes(l.id)))
      } else if (type === 'archive') {
        const { error: archErr } = await supabase
          .from('conversations')
          .update({ status: 'archived', updated_at: new Date().toISOString() })
          .in('id', ids)
        if (archErr) throw archErr
        if (statusFilter === 'archived') {
          setLeads((prev) => prev.filter((l) => !ids.includes(l.id)))
        } else {
          setLeads((prev) =>
            prev.map((l) => (ids.includes(l.id) ? { ...l, status: 'archived' } : l))
          )
        }
      } else if (type === 'restore') {
        const { error: restErr } = await supabase
          .from('conversations')
          .update({ status: 'active', updated_at: new Date().toISOString() })
          .in('id', ids)
        if (restErr) throw restErr
        setLeads((prev) => prev.filter((l) => !ids.includes(l.id)))
      }
      setSelectedIds(new Set())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed. Please try again.')
    } finally {
      setActionLoading(false)
      setConfirm(null)
    }
  }, [confirm, statusFilter])

  // ── Search filter ──

  const filteredLeads = leads.filter((lead) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      (lead.client_contact && lead.client_contact.toLowerCase().includes(q)) ||
      (lead.project_type && lead.project_type.toLowerCase().includes(q))
    )
  })

  const hasFilters = searchQuery.trim() !== '' || statusFilter !== 'all'
  const isArchiveView = statusFilter === 'archived'
  const allSelected = filteredLeads.length > 0 && selectedIds.size === filteredLeads.length

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-semibold text-foreground">
          {isArchiveView ? 'Archive' : 'Leads'}
        </h1>
        <p className="mt-1 text-sm text-foreground/60">
          {isArchiveView
            ? 'Archived leads — restore them or permanently delete'
            : 'Review and follow up on incoming leads from your widget'}
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
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter by status">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              role="tab"
              aria-selected={statusFilter === option.value}
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

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
          <span className="text-sm font-medium text-foreground">
            {selectedIds.size} lead{selectedIds.size !== 1 ? 's' : ''} selected
          </span>
          <div className="ml-auto flex items-center gap-2">
            {!isArchiveView && (
              <button
                onClick={() =>
                  setConfirm({
                    type: 'archive',
                    ids: Array.from(selectedIds),
                    title: 'Archive selected leads?',
                    message: `${selectedIds.size} lead${selectedIds.size !== 1 ? 's' : ''} will be moved to the archive.`,
                  })
                }
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-foreground/70 transition-all duration-150 hover:bg-muted hover:text-foreground active:scale-[0.97]"
              >
                <Archive className="h-3.5 w-3.5" />
                Archive
              </button>
            )}
            {isArchiveView && (
              <button
                onClick={() =>
                  setConfirm({
                    type: 'restore',
                    ids: Array.from(selectedIds),
                    title: 'Restore selected leads?',
                    message: `${selectedIds.size} lead${selectedIds.size !== 1 ? 's' : ''} will be moved back to active.`,
                  })
                }
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-foreground/70 transition-all duration-150 hover:bg-muted hover:text-foreground active:scale-[0.97]"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Restore
              </button>
            )}
            <button
              onClick={() =>
                setConfirm({
                  type: 'delete',
                  ids: Array.from(selectedIds),
                  title: 'Delete selected leads?',
                  message: `This permanently deletes ${selectedIds.size} lead${selectedIds.size !== 1 ? 's' : ''} and all associated data. This cannot be undone.`,
                })
              }
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-destructive/40 bg-white px-3 py-1.5 text-xs font-medium text-destructive transition-all duration-150 hover:bg-destructive/5 active:scale-[0.97]"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          </div>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="cursor-pointer rounded p-1 text-foreground/30 hover:text-foreground"
            aria-label="Clear selection"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <TableSkeleton />
      ) : filteredLeads.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-white px-6 py-16 text-center">
          <MessageSquare className="mb-3 h-10 w-10 text-foreground/20" aria-hidden="true" />
          <p className="text-sm font-medium text-foreground/60">
            {hasFilters
              ? 'No leads match your filters'
              : isArchiveView
              ? 'No archived leads'
              : 'No leads yet'}
          </p>
          <p className="mt-1 text-xs text-foreground/40 max-w-sm">
            {hasFilters
              ? 'Try adjusting your search or clearing the status filter.'
              : isArchiveView
              ? 'Archived leads will appear here.'
              : 'Add the chat widget to your site to start collecting leads automatically.'}
          </p>
          {!hasFilters && !isArchiveView && (
            <Link
              to="/dashboard/embed"
              className="mt-4 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-all duration-150 hover:opacity-90 active:scale-[0.97]"
            >
              Set up widget
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-white">
          {/* Table header */}
          <div className="hidden sm:grid sm:grid-cols-[auto_1fr_1.5fr_auto_auto] gap-4 border-b border-border bg-muted/50 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-foreground/50 items-center">
            {/* Select all checkbox */}
            <button
              onClick={toggleSelectAll}
              className="flex cursor-pointer items-center justify-center text-foreground/40 transition-colors duration-150 hover:text-foreground"
              aria-label={allSelected ? 'Deselect all' : 'Select all'}
            >
              {allSelected ? (
                <SquareCheck className="h-4 w-4" />
              ) : (
                <Square className="h-4 w-4" />
              )}
            </button>
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
          <div className="divide-y divide-border">
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
              const isSelected = selectedIds.has(lead.id)

              return (
                <div
                  key={lead.id}
                  className={`group grid grid-cols-[auto_1fr_auto] sm:grid-cols-[auto_1fr_1.5fr_auto_auto] gap-3 sm:gap-4 px-5 py-3.5 items-center transition-colors duration-150 hover:bg-muted/30 ${
                    isSelected ? 'bg-primary/5' : ''
                  }`}
                >
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleSelect(lead.id)}
                    className="flex cursor-pointer items-center justify-center text-foreground/30 transition-colors duration-150 hover:text-foreground"
                    aria-label={isSelected ? 'Deselect' : 'Select'}
                  >
                    {isSelected ? (
                      <SquareCheck className="h-4 w-4 text-primary" />
                    ) : (
                      <Square className="h-4 w-4 opacity-0 group-hover:opacity-100 sm:opacity-0" />
                    )}
                  </button>

                  {/* Date - desktop */}
                  <span className="hidden sm:block text-sm text-foreground/60">
                    {dateStr}
                  </span>

                  {/* Mobile card-style layout */}
                  <div className="sm:hidden">
                    <span className="text-xs text-foreground/50">{dateStr}</span>
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
                  <span className={`hidden sm:inline-flex items-center gap-1.5 font-mono text-xs font-semibold ${config.text}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} aria-hidden="true" />
                    {config.label}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    {/* Mobile: Status badge + View link */}
                    <span className={`sm:hidden inline-flex items-center gap-1.5 font-mono text-xs font-semibold ${config.text}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} aria-hidden="true" />
                      {config.label}
                    </span>
                    <Link
                      to={`/dashboard/leads/${lead.id}`}
                      className="inline-flex sm:hidden cursor-pointer items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-primary transition-colors duration-150 hover:bg-primary/10"
                    >
                      View
                    </Link>

                    {/* Desktop: hover-revealed actions */}
                    {!isArchiveView ? (
                      <>
                        <button
                          onClick={() => handleArchiveSingle(lead.id)}
                          className="cursor-pointer rounded-md p-1.5 text-foreground/40 opacity-0 group-hover:opacity-100 transition-all duration-150 hover:bg-emerald-50 hover:text-emerald-600 focus:opacity-100"
                          aria-label="Mark as handled"
                          title="Mark as handled"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleArchiveSingle(lead.id)}
                          className="cursor-pointer rounded-md p-1.5 text-foreground/40 opacity-0 group-hover:opacity-100 transition-all duration-150 hover:bg-muted hover:text-foreground focus:opacity-100"
                          aria-label="Archive lead"
                          title="Archive"
                        >
                          <Archive className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteSingle(lead.id)}
                          className="cursor-pointer rounded-md p-1.5 text-foreground/40 opacity-0 group-hover:opacity-100 transition-all duration-150 hover:bg-destructive/10 hover:text-destructive focus:opacity-100"
                          aria-label="Delete lead"
                          title="Delete permanently"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleRestoreSingle(lead.id)}
                          className="cursor-pointer rounded-md p-1.5 text-foreground/40 opacity-0 group-hover:opacity-100 transition-all duration-150 hover:bg-primary/10 hover:text-primary focus:opacity-100"
                          aria-label="Restore lead"
                          title="Restore"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteSingle(lead.id)}
                          className="cursor-pointer rounded-md p-1.5 text-foreground/40 opacity-0 group-hover:opacity-100 transition-all duration-150 hover:bg-destructive/10 hover:text-destructive focus:opacity-100"
                          aria-label="Delete lead permanently"
                          title="Delete permanently"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Result count */}
      {!loading && leads.length > 0 && (
        <p className="mt-3 text-xs text-foreground/40">
          Showing {filteredLeads.length} of {leads.length} lead{leads.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* Confirmation dialog */}
      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.title || ''}
        message={confirm?.message || ''}
        confirmLabel={
          confirm?.type === 'delete'
            ? 'Delete permanently'
            : confirm?.type === 'archive'
            ? 'Archive'
            : 'Restore'
        }
        variant={confirm?.type === 'delete' ? 'danger' : 'default'}
        loading={actionLoading}
        onConfirm={executeBulkAction}
        onCancel={() => {
          setConfirm(null)
          setActionLoading(false)
        }}
      />
    </div>
  )
}
