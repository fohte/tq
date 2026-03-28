/**
 * Parse a human-friendly duration string into minutes.
 * Supports: "1h", "1h30m", "30m", "90", "1.5h"
 * Returns null if the input cannot be parsed.
 */
export function parseDurationToMinutes(input: string): number | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  // Plain number → treat as minutes
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed)
  }

  // Decimal hours: "1.5h"
  const decimalHourMatch = trimmed.match(/^(\d+(?:\.\d+)?)h$/i)
  if (decimalHourMatch) {
    return Math.round(Number(decimalHourMatch[1]) * 60)
  }

  // Hours and/or minutes: "1h30m", "1h", "30m"
  const hmMatch = trimmed.match(/^(?:(\d+)h)?(?:(\d+)m)?$/i)
  if (hmMatch && (hmMatch[1] != null || hmMatch[2] != null)) {
    const hours = Number(hmMatch[1] ?? 0)
    const minutes = Number(hmMatch[2] ?? 0)
    return hours * 60 + minutes
  }

  return null
}

/**
 * Format minutes into a human-friendly duration string.
 */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${String(minutes)}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${String(h)}h${String(m)}m` : `${String(h)}h`
}
