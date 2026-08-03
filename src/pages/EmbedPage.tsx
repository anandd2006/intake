import { useState, useEffect } from 'react'
import { Code, Check, Copy } from 'lucide-react'
import { AnimateIn } from '../components/AnimateIn'

export function EmbedPage() {
  const [origin, setOrigin] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  const snippet = `<iframe
  src="${origin}/widget"
  style="position:fixed;bottom:0;right:0;width:400px;height:600px;max-width:100vw;max-height:100vh;border:none;z-index:9999"
  title="Intake Chat Widget"
></iframe>`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(snippet)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API not supported — fall back to select-and-copy
      const el = document.getElementById('embed-snippet') as HTMLTextAreaElement | null
      if (el) {
        el.select()
        document.execCommand('copy')
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    }
  }

  return (
    <AnimateIn from="bottom" distance="16px" duration={300}>
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        {/* Page heading */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Code className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Embed</h1>
            <p className="mt-0.5 text-sm text-foreground/60">
              Add the chat widget to any website with a single iframe snippet.
            </p>
          </div>
        </div>

        {/* Snippet card */}
        <div className="rounded-xl border border-border bg-white shadow-sm">
          <div className="border-b border-border px-5 py-4">
            <p className="text-sm text-foreground/70">
              Paste this into your site's HTML where you want the chat widget to
              appear.
            </p>
          </div>

          <div className="p-5">
            <div className="relative">
              <textarea
                id="embed-snippet"
                readOnly
                value={snippet}
                rows={6}
                className="w-full resize-none rounded-lg border border-border bg-muted/50 px-4 py-3 font-mono text-xs leading-relaxed text-foreground focus:outline-none"
                aria-label="Embed snippet"
              />
              <button
                onClick={handleCopy}
                className="absolute right-3 top-3 inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-white px-3 py-1.5 text-xs font-medium text-foreground/70 shadow-sm transition-all duration-150 hover:border-primary/30 hover:text-primary active:scale-[0.97]"
                aria-label={copied ? 'Copied' : 'Copy code'}
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    Copy code
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Preview note */}
          <div className="rounded-b-xl border-t border-border bg-muted/30 px-5 py-3">
            <p className="text-xs text-foreground/50">
              The widget loads from{' '}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                {origin}/widget
              </code>{' '}
              — the same origin your visitors will use.
            </p>
          </div>
        </div>
      </div>
    </AnimateIn>
  )
}