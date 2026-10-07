export type AgentSessionActivityFields = {
  endedAt: Date | string | null
  archivedAt: Date | string | null
  lastActiveAt: Date | string
}

export type AgentSessionActiveCriteria = {
  endedAt: Date | null
  archivedAt: Date | null
  lastActiveAtAfter: Date
}

// `lastActiveAt` advances at the end of a turn, so sessions stay active
// between turns.
const AGENT_SESSION_ACTIVE_WINDOW_MS = 30 * 60_000

export function getAgentSessionActiveCriteria(
  now: Date = new Date(),
): AgentSessionActiveCriteria {
  return {
    endedAt: null,
    archivedAt: null,
    lastActiveAtAfter: new Date(now.getTime() - AGENT_SESSION_ACTIVE_WINDOW_MS),
  }
}

export function isAgentSessionActive(
  session: AgentSessionActivityFields,
  now: Date = new Date(),
): boolean {
  const criteria = getAgentSessionActiveCriteria(now)

  return (
    matchesDateCriteria(session.endedAt, criteria.endedAt) &&
    matchesDateCriteria(session.archivedAt, criteria.archivedAt) &&
    new Date(session.lastActiveAt).getTime() >
      criteria.lastActiveAtAfter.getTime()
  )
}

function matchesDateCriteria(
  value: Date | string | null,
  expected: Date | null,
): boolean {
  if (expected === null) return value === null
  return value !== null && new Date(value).getTime() === expected.getTime()
}
