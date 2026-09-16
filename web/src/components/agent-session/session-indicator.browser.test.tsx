import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { SessionIndicator } from '#components/agent-session/session-indicator'
import { makeTaskAgentSession } from '#components/agent-session/task-agent-session-test-fixtures'
import { resetSessionOpenSettings } from '#hooks/session-open-settings-test-fixtures'
import type { TaskAgentSession } from '#hooks/use-task-agent-sessions'

const activeSession: TaskAgentSession = makeTaskAgentSession({
  id: '1',
  label: 'Implement session indicator',
  startedAt: new Date(Date.now() - 34 * 60_000).toISOString(),
  lastActiveAt: new Date(Date.now() - 2 * 60_000).toISOString(),
})

const endedSession: TaskAgentSession = {
  ...activeSession,
  id: '2',
  sessionId: 'session-2',
  label: 'Write the release notes',
  startedAt: '2026-08-20T09:00:00Z',
  lastActiveAt: '2026-08-20T10:15:00Z',
  endedAt: '2026-08-20T10:15:00Z',
}

function renderSessionIndicator(sessions: TaskAgentSession[]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  resetSessionOpenSettings({
    localContext: 'work',
    focusUrlTemplate: null,
    resumeUrlTemplate: null,
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <SessionIndicator sessions={sessions} />
    </QueryClientProvider>,
  )
}

describe('SessionIndicator', () => {
  it('renders nothing when there are no sessions', () => {
    renderSessionIndicator([])

    expect(screen.queryByTestId('session-indicator')).not.toBeInTheDocument()
  })

  it('opens the session card on hover', async () => {
    const user = userEvent.setup()
    renderSessionIndicator([endedSession, activeSession])

    await user.hover(screen.getByTestId('session-indicator'))

    const body = within(document.body)
    expect(await body.findByText('SESSIONS (2)')).toBeVisible()
    expect(body.getByText('Implement session indicator')).toBeVisible()
    expect(body.getByText('Write the release notes')).toBeVisible()
  })
})
