import type { AgentSession } from '#hooks/use-agent-sessions'
import type { TaskAgentSession } from '#hooks/use-task-agent-sessions'

export function makeAgentSession(
  overrides: Partial<AgentSession> = {},
): AgentSession {
  return {
    id: 'agent-session-1',
    provider: 'claude_code',
    sessionId: 'session-1',
    parentSessionId: null,
    context: 'work',
    cwd: '/Users/example/ghq/github.com/example/tq',
    label: 'Session label',
    lastMessage: null,
    customLabel: null,
    startedAt: '2026-03-20T11:00:00Z',
    lastActiveAt: '2026-03-20T11:50:00Z',
    endedAt: null,
    archivedAt: null,
    ...overrides,
  }
}

export function makeTaskAgentSession(
  overrides: Partial<TaskAgentSession> = {},
): TaskAgentSession {
  const session: Omit<AgentSession, 'lastMessage'> = { ...makeAgentSession() }
  Reflect.deleteProperty(session, 'lastMessage')

  return {
    ...session,
    taskId: 'task-1',
    taskNumber: 1,
    taskTitle: 'Task title',
    taskParentId: null,
    taskStatus: 'todo',
    linkedAt: '2030-01-01T00:00:00.000Z',
    ...overrides,
  }
}

// Kept relative to `Date.now()` (not a fixed ISO literal) so this session
// keeps rendering as active (isAgentSessionActive) no matter when it's used.
export const activeAgentSession: TaskAgentSession = makeTaskAgentSession({
  id: '1',
  taskTitle: 'Sample task',
  label: 'Implement session indicator',
  startedAt: new Date(Date.now() - 34 * 60_000).toISOString(),
  lastActiveAt: new Date(Date.now() - 2 * 60_000).toISOString(),
})

export const endedAgentSession: TaskAgentSession = {
  ...activeAgentSession,
  id: '2',
  sessionId: 'session-2',
  label: 'Write the release notes',
  startedAt: '2026-08-20T09:00:00Z',
  lastActiveAt: '2026-08-20T10:15:00Z',
  endedAt: '2026-08-20T10:15:00Z',
}
