import { MessageSquare } from 'lucide-react'
import { ChatPanel, useWidgetConfig } from '../components/ChatPanel'
import { AnimateIn } from '../components/AnimateIn'

/**
 * Standalone full-page widget — the primary distribution surface when a
 * visitor opens the direct link (not embedded in an iframe).
 * Centered chat with the freelancer's name/tagline header, full viewport.
 */
export function StandaloneWidget() {
  const config = useWidgetConfig()
  const title = config?.display_name?.trim() || 'Intake Assistant'
  const tagline = config?.tagline?.trim()

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-5 sm:px-6">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
            <MessageSquare className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate font-heading text-lg font-semibold text-foreground">
              {title}
            </h1>
            {tagline && <p className="truncate text-sm text-foreground/60">{tagline}</p>}
          </div>
        </div>
      </header>

      {/* Centered chat */}
      <main className="flex flex-1 items-start justify-center px-4 py-6 sm:px-6 sm:py-10">
        <AnimateIn from="fade" duration={250} className="h-[min(720px,calc(100vh-10rem))] w-full max-w-3xl">
          <ChatPanel config={config} />
        </AnimateIn>
      </main>

      <footer className="pb-6 text-center text-xs text-foreground/40">
        Powered by Intake
      </footer>
    </div>
  )
}
