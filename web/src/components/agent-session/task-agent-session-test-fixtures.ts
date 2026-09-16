import type { TaskAgentSession } from '#hooks/use-task-agent-sessions'

export function makeTaskAgentSession(
  overrides: Partial<TaskAgentSession> = {},
): TaskAgentSession {
  return {
    id: 'agent-session-1',
    taskId: 'task-1',
    taskNumber: 1,
    taskTitle: 'Task title',
    taskParentId: null,
    taskStatus: 'todo',
    provider: 'claude_code',
    sessionId: 'session-1',
    parentSessionId: null,
    context: 'work',
    cwd: '/Users/fohte/ghq/github.com/fohte/tq',
    label: 'Session label',
    lastMessage: null,
    customLabel: null,
    startedAt: '2026-03-20T00:00:00.000Z',
    lastActiveAt: '2026-03-20T00:00:00.000Z',
    endedAt: null,
    ...overrides,
  }
}

// Kept relative to `Date.now()` (not a fixed ISO literal) so this session
// keeps rendering as active (isAgentSessionActive) no matter when it's used.
export const activeAgentSession: TaskAgentSession = makeTaskAgentSession({
  id: '1',
  taskTitle: 'Sample task',
  label: 'Implement session indicator',
  lastMessage: 'Wiring up the hover card',
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
