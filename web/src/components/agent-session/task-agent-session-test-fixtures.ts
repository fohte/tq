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
