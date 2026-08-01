/**
 * Default schedule accent color when no custom color is set.
 */
const DEFAULT_ACCENT = '#6C63FF'

/**
 * Convert a schedule's hex color to the { accent } format used by EventBlock.
 */
export function scheduleColorToEventColor(color: string | null): {
  accent: string
} {
  return { accent: color != null && color !== '' ? color : DEFAULT_ACCENT }
}
