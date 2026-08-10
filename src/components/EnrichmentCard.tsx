import { Building2, Factory, Layers, Globe } from 'lucide-react'
import type { Enrichment } from '../types/features'

/**
 * Distinct "Enrichment" section rendered in the freelancer dashboard brief
 * view, the visitor-facing brief confirmation, and the shareable brief page.
 * Renders nothing when no enrichment exists (graceful omission).
 */
export function EnrichmentCard({
  enrichment,
  variant = 'default',
}: {
  enrichment: Enrichment | null
  variant?: 'default' | 'widget'
}) {
  if (!enrichment) return null

  const labelClass = variant === 'widget' ? 'text-foreground/50' : 'text-foreground/50'
  const valueClass = variant === 'widget' ? 'text-foreground' : 'text-foreground'
  const cardClass =
    variant === 'widget'
      ? 'rounded-xl bg-muted/50 p-4'
      : 'rounded-xl border border-border bg-white divide-y divide-border'

  return (
    <div className={cardClass}>
      <div className={variant === 'widget' ? 'mb-3' : 'px-5 py-3'}>
        <p
          className={`text-xs font-semibold uppercase tracking-wider ${variant === 'widget' ? 'text-foreground/70' : labelClass}`}
        >
          Enrichment
        </p>
        {variant === 'widget' && (
          <p className="mt-0.5 text-xs text-foreground/50">
            From {enrichment.source_domain} ·{' '}
            {new Date(enrichment.enriched_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        )}
      </div>

      <div className={variant === 'widget' ? 'space-y-3' : 'divide-y divide-border'}>
        <div className={variant === 'widget' ? '' : 'px-5 py-3.5'}>
          <div className="flex items-start gap-3">
            <Building2
              className={`mt-0.5 h-4 w-4 shrink-0 ${variant === 'widget' ? 'text-foreground/40' : 'text-foreground/40'}`}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className={`text-xs ${labelClass}`}>Company Size</p>
              <p className={`mt-0.5 text-sm ${valueClass}`}>
                {enrichment.company_size || 'Not specified'}
              </p>
            </div>
          </div>
        </div>

        <div className={variant === 'widget' ? '' : 'px-5 py-3.5'}>
          <div className="flex items-start gap-3">
            <Factory
              className={`mt-0.5 h-4 w-4 shrink-0 ${variant === 'widget' ? 'text-foreground/40' : 'text-foreground/40'}`}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className={`text-xs ${labelClass}`}>Industry</p>
              <p className={`mt-0.5 text-sm ${valueClass}`}>
                {enrichment.industry || 'Not specified'}
              </p>
            </div>
          </div>
        </div>

        {enrichment.tech_stack && enrichment.tech_stack.length > 0 && (
          <div className={variant === 'widget' ? '' : 'px-5 py-3.5'}>
            <div className="flex items-start gap-3">
              <Layers
                className={`mt-0.5 h-4 w-4 shrink-0 ${variant === 'widget' ? 'text-foreground/40' : 'text-foreground/40'}`}
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className={`text-xs ${labelClass}`}>Tech Stack</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {enrichment.tech_stack.map((tech) => (
                    <span
                      key={tech}
                      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                        variant === 'widget'
                          ? 'bg-border/50 text-foreground/70'
                          : 'bg-muted text-foreground/70'
                      }`}
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {enrichment.public_presence_summary && (
          <div className={variant === 'widget' ? '' : 'px-5 py-3.5'}>
            <div className="flex items-start gap-3">
              <Globe
                className={`mt-0.5 h-4 w-4 shrink-0 ${variant === 'widget' ? 'text-foreground/40' : 'text-foreground/40'}`}
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className={`text-xs ${labelClass}`}>Public Presence</p>
                <p className={`mt-0.5 text-sm leading-relaxed ${valueClass}`}>
                  {enrichment.public_presence_summary}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
