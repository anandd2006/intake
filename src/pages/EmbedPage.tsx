import { useState, useEffect } from 'react'
import { Code, Check, Copy, ExternalLink, LayoutPanelLeft } from 'lucide-react'
import { AnimateIn } from '../components/AnimateIn'

type SnippetKey = 'floating' | 'standalone'

export function EmbedPage() {
  const [origin, setOrigin] = useState('')
  const [copiedKey, setCopiedKey] = useState<SnippetKey | null>(null)

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  const snippets: Record<SnippetKey, { label: string; description: string; code: string }> = {
    floating: {
      label: 'Floating bubble',
      description:
        'A small bubble in the bottom-right corner of your site. Best for most websites — paste into your HTML.',
      code: `<iframe
  src="${origin}/widget"
  style="position:fixed;bottom:0;right:0;width:400px;height:600px;max-width:100vw;max-height:100vh;border:none;z-index:9999"
  title="Intake Chat Widget"
></iframe>`,
    },
    standalone: {
      label: 'Full-page chat',
      description:
        'A dedicated page with your name and tagline in the header. Share the link directly with clients.',
      code: `${origin}/chat`,
    },
  }

  const handleCopy = async (key: SnippetKey) => {
    const text = snippets[key].code
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 2000)
    } catch {
      // Clipboard API not supported — fall back to select-and-copy
      const el = document.getElementById(`embed-snippet-${key}`) as HTMLTextAreaElement | HTMLInputElement | null
      if (el) {
        el.select()
        document.execCommand('copy')
        setCopiedKey(key)
        setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 2000)
      }
    }
  }

  return (
    <AnimateIn from="fade" duration={200}>
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        {/* Page heading */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Code className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Embed</h1>
            <p className="mt-0.5 text-sm text-foreground/60">
              Put the chat widget on your site — or share a direct link.
            </p>
          </div>
        </div>

        {/* Snippet cards */}
        <div className="space-y-5">
          {(Object.keys(snippets) as SnippetKey[]).map((key) => {
            const snippet = snippets[key]
            const copied = copiedKey === key
            const isLink = key === 'standalone'
            return (
              <div key={key} className="rounded-xl border border-border bg-white shadow-sm">
                <div className="border-b border-border px-5 py-4">
                  <div className="flex items-center gap-2">
                    {key === 'floating' ? (
                      <LayoutPanelLeft className="h-4 w-4 text-primary" aria-hidden="true" />
                    ) : (
                      <ExternalLink className="h-4 w-4 text-primary" aria-hidden="true" />
                    )}
                    <p className="text-sm font-semibold text-foreground">{snippet.label}</p>
                  </div>
                  <p className="mt-1 text-xs text-foreground/60">{snippet.description}</p>
                </div>

                <div className="p-5">
                  <div className="relative">
                    {isLink ? (
                      <input
                        id={`embed-snippet-${key}`}
                        readOnly
                        value={snippet.code}
                        className="w-full rounded-lg border border-border bg-muted/50 px-4 py-3 font-mono text-xs text-foreground focus:outline-none"
                        aria-label={`${snippet.label} link`}
                      />
                    ) : (
                      <textarea
                        id={`embed-snippet-${key}`}
                        readOnly
                        value={snippet.code}
                        rows={6}
                        className="w-full resize-none rounded-lg border border-border bg-muted/50 px-4 py-3 font-mono text-xs leading-relaxed text-foreground focus:outline-none"
                        aria-label={`${snippet.label} embed snippet`}
                      />
                    )}
                    <button
                      onClick={() => handleCopy(key)}
                      className="absolute right-3 top-3 inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-white px-3 py-1.5 text-xs font-medium text-foreground/70 shadow-sm transition-all duration-150 hover:border-primary/30 hover:text-primary active:scale-[0.97]"
                      aria-label={copied ? 'Copied' : `Copy ${snippet.label}`}
                    >
                      {copied ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Preview note */}
        <div className="rounded-b-xl rounded-t-xl border border-border bg-muted/30 px-5 py-3">
          <p className="text-xs text-foreground/50">
            Set your business name and tagline in the{' '}
            <a
              href="/dashboard/knowledge-base"
              className="cursor-pointer font-medium text-primary underline-offset-2 hover:underline"
            >
              Knowledge Base
            </a>{' '}
            — they appear in the widget header.
          </p>
        </div>
      </div>
    </AnimateIn>
  )
}