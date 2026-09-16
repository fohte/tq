import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { SessionIndicator } from '#components/agent-session/session-indicator'
import {
  activeAgentSession,
  endedAgentSession,
} from '#components/agent-session/task-agent-session-test-fixtures'
import { resetSessionOpenSettings } from '#hooks/session-open-settings-test-fixtures'
import type { TaskAgentSession } from '#hooks/use-task-agent-sessions'

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
    renderSessionIndicator([endedAgentSession, activeAgentSession])

    await user.hover(screen.getByTestId('session-indicator'))

    const body = within(document.body)
    await waitFor(() => {
      expect(body.getByText('SESSIONS (2)')).toBeVisible()
    })
    expect(body.getByText('Implement session indicator')).toBeVisible()
    expect(body.getByText('Write the release notes')).toBeVisible()
  })
})
