/**
 * Default schedule colors when no custom color is set.
 */
const DEFAULT_BG = '#2D2B55'
const DEFAULT_ACCENT = '#6C63FF'

/**
 * Convert a schedule's hex color to the { bg, accent } format used by EventBlock.
 *
 * The accent color is the schedule's custom color (or a default purple).
 * The background is a darkened version of the accent to maintain readability.
 */
export function scheduleColorToEventColor(color: string | null): {
  bg: string
  accent: string
} {
  if (color == null || color === '') {
    return { bg: DEFAULT_BG, accent: DEFAULT_ACCENT }
  }

  return {
    bg: darkenHex(color, 0.7),
    accent: color,
  }
}

/**
 * Darken a hex color by mixing it with black.
 * @param hex - Hex color string (e.g., "#52B788")
 * @param factor - How much to darken (0 = black, 1 = original)
 */
function darkenHex(hex: string, factor: number): string {
  const cleaned = hex.replace('#', '')
  const r = Math.round(Number.parseInt(cleaned.slice(0, 2), 16) * (1 - factor))
  const g = Math.round(Number.parseInt(cleaned.slice(2, 4), 16) * (1 - factor))
  const b = Math.round(Number.parseInt(cleaned.slice(4, 6), 16) * (1 - factor))
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}
