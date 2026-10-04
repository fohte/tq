const COMPACT_REFRESH_INTERVAL_MS = 60_000

export function isCompactDayLayoutSearch(search: {
  layout?: unknown
}): boolean {
  return search['layout'] === 'compact'
}

export function getCompactRefetchInterval(
  isCompactLayout: boolean,
): number | undefined {
  return isCompactLayout ? COMPACT_REFRESH_INTERVAL_MS : undefined
}
