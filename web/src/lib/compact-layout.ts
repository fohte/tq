import { formatLocalDate } from '#lib/date-range'

const COMPACT_REFRESH_INTERVAL_MS = 60_000
const NOW_PANEL_LOOKAHEAD_DAYS = 30

export function isCompactDayLayoutSearch(search: unknown): boolean {
  return (
    typeof search === 'object' &&
    search !== null &&
    'layout' in search &&
    search['layout'] === 'compact'
  )
}

export function isCompactDayLayoutMatch(
  routeId: string,
  search: unknown,
): boolean {
  return (
    (routeId === '/' || routeId === '/memo') && isCompactDayLayoutSearch(search)
  )
}

export function getCompactRefetchInterval(
  isCompactLayout: boolean,
): number | undefined {
  return isCompactLayout ? COMPACT_REFRESH_INTERVAL_MS : undefined
}

export function getNowPanelQueryDateRange(now: Date): {
  startDate: string
  endDate: string
} {
  const today = formatLocalDate(now)
  const lookaheadEnd = new Date(now)
  lookaheadEnd.setHours(0, 0, 0, 0)
  lookaheadEnd.setDate(lookaheadEnd.getDate() + NOW_PANEL_LOOKAHEAD_DAYS)

  return {
    startDate: today,
    endDate: formatLocalDate(lookaheadEnd),
  }
}
