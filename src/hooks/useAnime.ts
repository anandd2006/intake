import { useEffect, useRef } from 'react'
import { animate, stagger as animeStagger } from 'animejs'

/**
 * Checks the user's motion preference.
 * All animations are disabled when `prefers-reduced-motion: reduce` is set.
 */
const REDUCED_MOTION =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

// ─── Staggered reveal for children of a container ───────────────────────

interface RevealOptions {
  /** Delay in ms between each child element (default 40) */
  staggerBy?: number
  /** Total animation duration per element in ms (default 350) */
  duration?: number
  /** Entrance direction (default 'bottom') */
  from?: 'bottom' | 'left' | 'right' | 'scale' | 'fade'
  /** Distance to travel from (default '12px') */
  distance?: string
}

/**
 * Attach to a container ref. On mount it staggers child elements
 * (opacity + translate) for a polished entrance cascade.
 *
 * Pass `deps` to re-trigger — or leave empty for a one-shot mount effect.
 */
export function useAnimeStagger<T extends HTMLElement>(
  deps: unknown[] = [],
  options: RevealOptions = {},
) {
  const ref = useRef<T>(null)
  const hasRun = useRef(false)

  const {
    staggerBy = 40,
    duration = 350,
    from = 'bottom',
    distance = '12px',
  } = options

  useEffect(() => {
    if (REDUCED_MOTION || !ref.current) return

    const children = ref.current.children
    if (children.length === 0) return

    // Never re-animate if already done (one-shot)
    if (hasRun.current) return

    const entries = children as unknown as HTMLElement[]

    // Set initial state immediately (required for opacity 0→1)
    for (const el of entries) {
      el.style.opacity = '0'
      if (from === 'bottom') el.style.transform = `translateY(${distance})`
      else if (from === 'left') el.style.transform = `translateX(-${distance})`
      else if (from === 'right') el.style.transform = `translateX(${distance})`
      else if (from === 'scale') el.style.transform = `scale(0.95)`
    }

    const anim = animate(entries, {
      opacity: 1,
      translateY: from === 'bottom' ? '0px' : undefined,
      translateX: from === 'left' || from === 'right' ? '0px' : undefined,
      scale: from === 'scale' ? 1 : undefined,
      duration,
      easing: 'easeOutCubic',
      delay: animeStagger(staggerBy),
    })

    hasRun.current = true

    return () => {
      anim.cancel()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return ref
}

// ─── Count-up for numbers ──────────────────────────────────────────────

/**
 * Attach to a `<span>` or `<div>` that displays a number.
 * Animates from the previous value to `target` on change.
 */
export function useCountUp<T extends HTMLElement>(
  target: number,
  deps: unknown[] = [],
  duration = 500,
) {
  const ref = useRef<T>(null)
  const prevValue = useRef(0)

  useEffect(() => {
    if (REDUCED_MOTION || !ref.current) return

    const obj = { value: prevValue.current }

    const anim = animate(obj, {
      value: target,
      duration,
      easing: 'easeOutCubic',
      onUpdate: () => {
        if (ref.current) {
          ref.current.textContent = Math.round(obj.value).toString()
        }
      },
    })

    prevValue.current = target
    return () => anim.cancel()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return ref
}

// ─── Single element entrance ───────────────────────────────────────────

interface EnterOptions {
  duration?: number
  from?: 'bottom' | 'fade' | 'scale'
  distance?: string
  delay?: number
}

/**
 * Animate a single element on mount (e.g. a card, a panel, a notice).
 */
export function useAnimeEnter<T extends HTMLElement>(
  deps: unknown[] = [],
  options: EnterOptions = {},
) {
  const ref = useRef<T>(null)
  const hasRun = useRef(false)

  const { duration = 350, from = 'bottom', distance = '16px', delay = 0 } = options

  useEffect(() => {
    if (REDUCED_MOTION || !ref.current || hasRun.current) return

    const el = ref.current
    el.style.opacity = '0'
    if (from === 'bottom') el.style.transform = `translateY(${distance})`
    else if (from === 'scale') el.style.transform = 'scale(0.95)'

    const anim = animate(el, {
      opacity: 1,
      translateY: from === 'bottom' ? '0px' : undefined,
      scale: from === 'scale' ? 1 : undefined,
      duration,
      easing: 'easeOutCubic',
      delay,
    })

    hasRun.current = true
    return () => anim.cancel()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return ref
}