import { useEffect, useState } from 'react'

export interface VisualViewportInsets {
  top: number
  height: number
}

// Browser zoom leaves sub-pixel gaps between the (rounded) integer
// `window.innerHeight` and the float `visualViewport.height` even when
// nothing is actually shrinking the visual viewport; keyboard/pinch-zoom
// deltas this hook cares about are far larger than that.
const VIEWPORT_HEIGHT_EPSILON = 1

function getVisualViewportInsets(): VisualViewportInsets | null {
  const viewport = window.visualViewport
  if (!viewport) return null
  // Visual viewport matches layout viewport: nothing to compensate for.
  if (
    viewport.offsetTop === 0 &&
    Math.abs(viewport.height - window.innerHeight) < VIEWPORT_HEIGHT_EPSILON
  ) {
    return null
  }
  return { top: viewport.offsetTop, height: viewport.height }
}

// iOS Safari doesn't shrink the layout viewport when the software keyboard
// opens, so a `position: fixed` element anchored to `inset-0` renders behind
// it. Track the visual viewport instead and reposition/resize to match.
export function useVisualViewportInsets(): VisualViewportInsets | null {
  const [insets, setInsets] = useState(getVisualViewportInsets)

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return

    const handleChange = () => {
      setInsets(getVisualViewportInsets())
    }
    viewport.addEventListener('resize', handleChange)
    viewport.addEventListener('scroll', handleChange)
    return () => {
      viewport.removeEventListener('resize', handleChange)
      viewport.removeEventListener('scroll', handleChange)
    }
  }, [])

  return insets
}
