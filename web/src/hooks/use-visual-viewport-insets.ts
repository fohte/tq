import { useEffect, useState } from 'react'

export interface VisualViewportInsets {
  top: number
  height: number
}

function getVisualViewportInsets(): VisualViewportInsets | null {
  const viewport = window.visualViewport
  if (!viewport) return null
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
