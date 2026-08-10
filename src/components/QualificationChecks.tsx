import type { QualificationCheck } from '../types/features'
import { CHECK_LABELS } from '../types/features'

/**
 * Terminal/diff-style qualification checklist.
 * Dark inset panel, monospace, +/-/~ prefixes for pass/fail/partial.
 * This is the visual centrepiece of the Lead Detail page — not a generic list.
 */
export function QualificationChecks({
  checks,
  compact = false,
}: {
  checks: QualificationCheck[]
  compact?: boolean
}) {
  if (!checks || checks.length === 0) return null

  return (
    <div
      className="overflow-hidden rounded-xl border border-border/60 bg-[#1A1A1E] shadow-[inset_0_1px_3px_rgba(0,0,0,0.3)]"
      role="list"
      aria-label="Qualification checks"
    >
      {/* Terminal title bar */}
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500" aria-hidden="true" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500" aria-hidden="true" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden="true" />
        </div>
        <span className="ml-2 font-mono text-[11px] font-medium uppercase tracking-wider text-white/40">
          Qualification
        </span>
      </div>

      {/* Checklist rows */}
      <div className={compact ? 'space-y-0 divide-y divide-white/5' : 'space-y-0 divide-y divide-white/5'}>
        {checks.map((check, i) => {
          const label = CHECK_LABELS[check.check_name] || check.check_name
          const prefix = check.result === 'pass' ? '+' : check.result === 'fail' ? '−' : '~'
          const prefixColor =
            check.result === 'pass'
              ? 'text-emerald-400'
              : check.result === 'fail'
                ? 'text-red-400'
                : 'text-amber-400'

          return (
            <div
              key={`${check.check_name}-${i}`}
              className="flex items-start gap-3 px-4 py-3 font-mono text-sm leading-relaxed"
              role="listitem"
              aria-label={`${label}: ${check.result}`}
            >
              <span className={`shrink-0 font-bold ${prefixColor} tabular-nums`}>
                {prefix}
              </span>
              <div className="min-w-0">
                <span className="text-white/90">{label}</span>
                <span className="text-white/40 ml-2">{check.detail}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}