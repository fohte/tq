import { describe, expect, it } from 'vitest'

import {
  type AgentSession,
  isAgentSessionActive,
} from '#hooks/use-agent-sessions'

const baseSession: AgentSession = {
  id: '1',
  provider: 'claude_code',
  sessionId: 'session-1',
  parentSessionId: null,
  context: 'work',
  cwd: '/tmp/example',
  label: null,
  lastMessage: null,
  customLabel: null,
  startedAt: '2026-03-20T11:00:00Z',
  lastActiveAt: '2026-03-20T11:50:00Z',
  endedAt: null,
}

describe('isAgentSessionActive', () => {
  const now = new Date('2026-03-20T12:00:00Z')

  it('returns true when not ended and last active within the stale threshold', () => {
    expect(isAgentSessionActive(baseSession, now)).toBe(true)
  })

  it('returns false when ended, regardless of how recent lastActiveAt is', () => {
    expect(
      isAgentSessionActive(
        { ...baseSession, endedAt: '2026-03-20T11:59:00Z' },
        now,
      ),
    ).toBe(false)
  })

  it('returns false when not ended but lastActiveAt is stale', () => {
    expect(
      isAgentSessionActive(
        { ...baseSession, lastActiveAt: '2026-03-20T11:00:00Z' },
        now,
      ),
    ).toBe(false)
  })
})
