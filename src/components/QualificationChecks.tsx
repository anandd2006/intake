import { Check, X, Minus } from 'lucide-react'
import type { QualificationCheck } from '../types/features'
import { CHECK_LABELS } from '../types/features'

const resultStyles: Record<string, string> = {
  pass: 'bg-green-50 text-green-600 border-green-200',
  fail: 'bg-red-50 text-red-600 border-red-200',
  partial: 'bg-amber-50 text-amber-600 border-amber-200',
}

const resultIcon = {
  pass: <Check className="h-3.5 w-3.5" aria-hidden="true" />,
  fail: <X className="h-3.5 w-3.5" aria-hidden="true" />,
  partial: <Minus className="h-3.5 w-3.5" aria-hidden="true" />,
}

/**
 * Primary UI element for the freelancer dashboard: a structured
 * ✓ / ✗ / ~ checklist of why a lead was qualified the way it was.
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
    <ul className={compact ? 'space-y-1.5' : 'space-y-2'}>
      {checks.map((check, i) => {
        const label = CHECK_LABELS[check.check_name] || check.check_name
        return (
          <li key={`${check.check_name}-${i}`} className="flex items-start gap-2.5">
            <span
              className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${resultStyles[check.result] || resultStyles.partial}`}
              aria-label={`${label}: ${check.result}`}
              role="img"
            >
              {resultIcon[check.result] || resultIcon.partial}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{label}</p>
              <p className="text-xs text-foreground/60">{check.detail}</p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
