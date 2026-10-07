export type AgentSessionActivityFields = {
  endedAt: Date | string | null
  archivedAt: Date | string | null
  lastActiveAt: Date | string
}

// `lastActiveAt` advances at the end of a turn, so sessions stay active
// between turns.
const AGENT_SESSION_ACTIVE_WINDOW_MS = 30 * 60_000

export function getAgentSessionActiveCriteria(now: Date = new Date()) {
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
    session.endedAt === criteria.endedAt &&
    session.archivedAt === criteria.archivedAt &&
    new Date(session.lastActiveAt).getTime() >
      criteria.lastActiveAtAfter.getTime()
  )
}
