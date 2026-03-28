export function formatMinutes(minutes: number): string {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return m > 0 ? `${String(h)}h ${String(m)}m` : `${String(h)}h`
  }
  return `${String(minutes)}m`
}
