import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
  Users,
  Target,
  ArrowRight,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useCountUp } from '../hooks/useAnime'

interface Stats {
  totalThisWeek: number
  qualifiedCount: number
  qualifiedRate: number
  recentActivity: Array<{
    id: string
    status: string
    created_at: string
    project_type: string | null
    client_contact: string | null
  }>
}

interface PreviousStats {
  total: number
  qualified: number
}

const statusConfig: Record<string, { label: string; text: string }> = {
  qualified: { label: 'Qualified', text: 'text-emerald-600' },
  needs_info: { label: 'Needs Info', text: 'text-amber-600' },
  out_of_scope: { label: 'Out of Scope', text: 'text-foreground/50' },
  active: { label: 'In Progress', text: 'text-primary' },
}

function getMonday(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  date.setDate(diff)
  date.setHours(0, 0, 0, 0)
  return date
}

function getPreviousWeekRange(): { start: string; end: string } {
  const now = new Date()
  const thisMon = getMonday(now)
  const prevMon = new Date(thisMon)
  prevMon.setDate(prevMon.getDate() - 7)
  return {
    start: prevMon.toISOString(),
    end: thisMon.toISOString(),
  }
}

function TrendBadge({ current, previous, format = 'number' }: { current: number; previous: number; format?: 'number' | 'pct' }) {
  if (previous === 0) return null
  const diff = current - previous
  const pct = Math.round((diff / previous) * 100)
  if (diff === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground/40 border border-border">
        <Minus className="h-3 w-3" />
        No change
      </span>
    )
  }
  const isUp = diff > 0
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-xs font-medium ${
      isUp
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : 'bg-red-50 text-red-700 border-red-200'
    }`}>
      {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {format === 'pct' ? `${Math.abs(pct)}%` : Math.abs(diff)}
      <span className="opacity-60"> vs last week</span>
    </span>
  )
}

function StatSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-white p-6">
      <div className="skeleton mb-4 h-10 w-10 rounded-lg" />
      <div className="skeleton mb-1 h-9 w-20" />
      <div className="skeleton mb-3 h-4 w-32" />
    </div>
  )
}

export function OverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [previous, setPrevious] = useState<PreviousStats>({ total: 0, qualified: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const totalRef = useCountUp<HTMLDivElement>(stats?.totalThisWeek ?? 0, [stats?.totalThisWeek], 600)
  const rateRef = useCountUp<HTMLDivElement>(stats?.qualifiedRate ?? 0, [stats?.qualifiedRate], 600)

  useEffect(() => {
    loadStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadStats = async () => {
    setLoading(true)
    setError(null)

    try {
      const monday = getMonday(new Date()).toISOString()

      const { data: weeklyConversations, error: convError } = await supabase
        .from('conversations')
        .select('id, status, created_at, visitor_id')
        .gte('created_at', monday)
        .order('created_at', { ascending: false })

      if (convError) throw convError

      const totalThisWeek = weeklyConversations?.length || 0
      const qualifiedCount = weeklyConversations?.filter(
        (c) => c.status === 'qualified'
      ).length || 0
      const qualifiedRate = totalThisWeek > 0
        ? Math.round((qualifiedCount / totalThisWeek) * 100)
        : 0

      const { start: prevStart, end: prevEnd } = getPreviousWeekRange()
      const { data: prevConversations } = await supabase
        .from('conversations')
        .select('status')
        .gte('created_at', prevStart)
        .lt('created_at', prevEnd)

      setPrevious({
        total: prevConversations?.length || 0,
        qualified: prevConversations?.filter((c) => c.status === 'qualified').length || 0,
      })

      const { data: briefs } = await supabase
        .from('briefs')
        .select('conversation_id, client_contact, project_type')

      const briefMap = new Map(
        (briefs || []).map((b) => [b.conversation_id, b])
      )

      const { data: recentData, error: recentError } = await supabase
        .from('conversations')
        .select('id, status, created_at')
        .order('created_at', { ascending: false })
        .limit(10)

      if (recentError) throw recentError

      const recentActivity = (recentData || []).map((c) => {
        const brief = briefMap.get(c.id)
        return {
          id: c.id,
          status: c.status,
          created_at: c.created_at,
          project_type: brief?.project_type || null,
          client_contact: brief?.client_contact || null,
        }
      })

      setStats({
        totalThisWeek,
        qualifiedCount,
        qualifiedRate,
        recentActivity,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-heading text-2xl font-semibold text-foreground">
          Overview
        </h1>
        <p className="mt-1 text-sm text-foreground/60">
          This week's lead activity at a glance
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">
          {error}
        </div>
      )}

      {/* Metric Cards */}
      {loading ? (
        <div className="mb-8 grid gap-5 sm:grid-cols-2">
          <StatSkeleton />
          <StatSkeleton />
        </div>
      ) : (
        <div className="mb-8 grid gap-5 sm:grid-cols-2">
          {/* Total Leads card */}
          <div className="rounded-xl border border-border bg-white p-6 transition-all duration-150 hover:shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Users className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4">
              <div ref={totalRef} className="font-heading text-3xl font-bold tracking-tight text-foreground">
                {stats?.totalThisWeek ?? 0}
              </div>
              <div className="mt-1 text-sm text-foreground/60">
                Total leads this week
              </div>
              {previous.total > 0 && (
                <div className="mt-2">
                  <TrendBadge current={stats?.totalThisWeek ?? 0} previous={previous.total} />
                </div>
              )}
            </div>
          </div>

          {/* Qualified Rate card */}
          <div className="rounded-xl border border-border bg-white p-6 transition-all duration-150 hover:shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Target className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4">
              <div ref={rateRef} className="font-heading text-3xl font-bold tracking-tight text-foreground">
                {stats?.qualifiedRate ?? 0}%
              </div>
              <div className="mt-1 text-sm text-foreground/60">
                Qualified rate{' '}
                <span className="text-foreground/40">
                  ({stats?.qualifiedCount ?? 0} / {stats?.totalThisWeek ?? 0})
                </span>
              </div>
              {previous.qualified > 0 && (
                <div className="mt-2">
                  <TrendBadge current={stats?.qualifiedCount ?? 0} previous={previous.qualified} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold text-foreground">
            Recent Activity
          </h2>
          <Link
            to="/dashboard/leads"
            className="inline-flex cursor-pointer items-center gap-1 text-sm font-medium text-primary transition-colors duration-150 hover:text-primary/80"
          >
            View all
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="divide-y divide-border rounded-xl border border-border bg-white">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                <div className="flex-1">
                  <div className="skeleton h-4 w-36" />
                </div>
                <div className="skeleton h-5 w-20 rounded-full" />
                <div className="skeleton h-4 w-28" />
              </div>
            ))}
          </div>
        ) : stats && stats.recentActivity.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-white px-6 py-12 text-center">
            <MessageSquare className="mb-3 h-8 w-8 text-foreground/20" aria-hidden="true" />
            <p className="text-sm font-medium text-foreground/60">
              No leads yet
            </p>
            <p className="mt-1 text-xs text-foreground/40 max-w-sm">
              Go to <strong>Embed</strong> to add the chat widget to your site. Once visitors start chatting, their leads will appear here.
            </p>
            <Link
              to="/dashboard/embed"
              className="mt-4 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-all duration-150 hover:opacity-90 active:scale-[0.97]"
            >
              Set up widget
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-white">
            {stats?.recentActivity.map((item) => {
              const config = statusConfig[item.status] || statusConfig.active
              const date = new Date(item.created_at)
              const dateStr = date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })

              return (
                <Link
                  key={item.id}
                  to={`/dashboard/leads/${item.id}`}
                  className="flex cursor-pointer items-center gap-4 px-5 py-3.5 transition-all duration-150 hover:bg-muted/50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground truncate">
                        {item.client_contact || 'Anonymous visitor'}
                      </span>
                      {item.project_type && (
                        <span className="hidden sm:inline text-xs text-foreground/40">
                          · {item.project_type}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className={`text-xs font-medium ${config.text}`}>
                    {config.label}
                  </span>
                  <span className="text-xs text-foreground/40 whitespace-nowrap">
                    {dateStr}
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}