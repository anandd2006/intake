import { useState } from 'react'
import { MessageSquare } from 'lucide-react'
import { ChatPanel, useWidgetConfig } from '../components/ChatPanel'
import { AnimateIn } from '../components/AnimateIn'

/**
 * Floating chat bubble — the embeddable distribution surface.
 * Loaded inside an iframe on the customer's site at /widget.
 * Renders a small fixed bubble in the bottom-right; opens a chat panel.
 */
export function FloatingWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const config = useWidgetConfig()

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3">
      {/* Chat panel */}
      {isOpen && (
        <AnimateIn from="fade" duration={200} className="h-[560px] w-[380px] max-w-[calc(100vw-2rem)]">
          <ChatPanel config={config} onClose={() => setIsOpen(false)} />
        </AnimateIn>
      )}

      {/* Floating bubble */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="relative flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-primary text-white shadow-lg transition-all duration-150 hover:scale-105 hover:bg-primary/90 active:scale-[0.97]"
          aria-label="Open chat"
        >
          <MessageSquare className="h-6 w-6" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
