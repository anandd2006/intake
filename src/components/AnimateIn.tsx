import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { animate } from 'animejs'

const REDUCED_MOTION =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

interface AnimateInProps {
  children: ReactNode
  /** Animation duration in ms (default 300) */
  duration?: number
  /** Entrance style (default 'bottom') */
  from?: 'bottom' | 'fade' | 'scale'
  /** Delay in ms (default 0) */
  delay?: number
  /** Distance in px to travel from (default 16) */
  distance?: string
  className?: string
  style?: CSSProperties
}

/**
 * Wraps content and animates its entrance on mount.
 * Respects `prefers-reduced-motion` and never blocks interaction.
 */
export function AnimateIn({
  children,
  duration = 300,
  from = 'bottom',
  delay = 0,
  distance = '16px',
  className,
  style,
}: AnimateInProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || REDUCED_MOTION) return

    el.style.opacity = '0'
    if (from === 'bottom') el.style.transform = `translateY(${distance})`
    else if (from === 'scale') el.style.transform = 'scale(0.96)'

    const anim = animate(el, {
      opacity: 1,
      translateY: from === 'bottom' ? '0px' : undefined,
      scale: from === 'scale' ? 1 : undefined,
      duration,
      easing: 'easeOutCubic',
      delay,
    })

    return () => anim.cancel()
  }, [duration, from, distance, delay])

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  )
}