import { describe, expect, it } from 'vitest'

import { makeAgentSession } from '#components/agent-session/task-agent-session-test-fixtures'
import {
  type AgentSession,
  isAgentSessionActive,
} from '#hooks/use-agent-sessions'

const baseSession: AgentSession = makeAgentSession({
  id: '1',
  label: null,
})

describe('isAgentSessionActive', () => {
  const now = new Date('2026-03-20T12:00:00Z')

  it('returns true just before the stale cutoff', () => {
    expect(
      isAgentSessionActive(
        { ...baseSession, lastActiveAt: '2026-03-20T11:30:00.001Z' },
        now,
      ),
    ).toBe(true)
  })

  it('returns false when ended', () => {
    expect(
      isAgentSessionActive(
        { ...baseSession, endedAt: '2026-03-20T11:59:00Z' },
        now,
      ),
    ).toBe(false)
  })

  it('returns false when archived', () => {
    expect(
      isAgentSessionActive(
        { ...baseSession, archivedAt: '2026-03-20T11:59:00Z' },
        now,
      ),
    ).toBe(false)
  })

  it('returns false at the 30-minute boundary', () => {
    expect(
      isAgentSessionActive(
        { ...baseSession, lastActiveAt: '2026-03-20T11:30:00Z' },
        now,
      ),
    ).toBe(false)
  })
})
