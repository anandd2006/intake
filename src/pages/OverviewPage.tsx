import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Loader2, Users, Target, ArrowRight, MessageSquare } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useCountUp, useAnimeStagger } from '../hooks/useAnime'

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

const statusConfig: Record<string, { label: string; color: string }> = {
  qualified: { label: 'Qualified', color: 'text-green-600 bg-green-50 border-green-200' },
  needs_info: { label: 'Needs Info', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  out_of_scope: { label: 'Out of Scope', color: 'text-gray-500 bg-gray-50 border-gray-200' },
  active: { label: 'In Progress', color: 'text-blue-600 bg-blue-50 border-blue-200' },
}

function getMonday(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  date.setDate(diff)
  date.setHours(0, 0, 0, 0)
  return date
}

export function OverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // anime.js — count-up on stat cards once data arrives
  const totalRef = useCountUp<HTMLDivElement>(stats?.totalThisWeek ?? 0, [stats?.totalThisWeek], 600)
  const rateRef = useCountUp<HTMLDivElement>(stats?.qualifiedRate ?? 0, [stats?.qualifiedRate], 600)
  // Staggered entrance for recent activity rows (one-shot after load)
  const activityRef = useAnimeStagger<HTMLDivElement>(
    [loading, stats?.recentActivity?.length ?? 0],
    { staggerBy: 45, duration: 320, from: 'fade' }
  )

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    setLoading(true)
    setError(null)

    try {
      const monday = getMonday(new Date()).toISOString()

      // Fetch conversations created this week
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

      // Fetch recent briefs for activity display
      const { data: briefs } = await supabase
        .from('briefs')
        .select('conversation_id, client_contact, project_type')

      const briefMap = new Map(
        (briefs || []).map((b) => [b.conversation_id, b])
      )

      // Fetch all conversations for recent activity (limit 10)
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

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
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
      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-white p-5">
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <div ref={totalRef} className="text-3xl font-semibold text-foreground">
              {stats?.totalThisWeek ?? 0}
            </div>
            <div className="mt-1 text-sm text-foreground/60">
              Total Leads This Week
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-white p-5">
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 text-green-600">
              <Target className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <div ref={rateRef} className="text-3xl font-semibold text-foreground">
              {stats?.qualifiedRate ?? 0}%
            </div>
            <div className="mt-1 text-sm text-foreground/60">
              Qualified Rate{' '}
              <span className="text-foreground/40">
                ({stats?.qualifiedCount ?? 0} / {stats?.totalThisWeek ?? 0})
              </span>
            </div>
          </div>
        </div>
      </div>

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

        {stats && stats.recentActivity.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-white px-6 py-12 text-center">
            <MessageSquare className="mb-3 h-8 w-8 text-foreground/20" />
            <p className="text-sm font-medium text-foreground/60">
              No conversations yet
            </p>
            <p className="mt-1 text-xs text-foreground/40">
              Leads will appear here once visitors start chatting with the widget
            </p>
          </div>
        ) : (
          <div ref={activityRef} className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-white">
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
                  className="flex cursor-pointer items-center gap-4 px-5 py-3.5 transition-colors duration-150 hover:bg-muted/50"
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
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                      config.color
                    }`}
                  >
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