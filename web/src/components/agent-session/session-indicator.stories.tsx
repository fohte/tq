import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, waitFor, within } from 'storybook/test'

import { SessionIndicator } from '#components/agent-session/session-indicator'
import { resetSessionOpenSettings } from '#hooks/session-open-settings-test-fixtures'
import type { TaskAgentSession } from '#hooks/use-task-agent-sessions'

// Kept relative to `Date.now()` (not a fixed ISO literal) so this session
// keeps rendering as active (isAgentSessionActive) no matter when this story
// runs.
const activeSession: TaskAgentSession = {
  id: '1',
  taskId: 'task-1',
  provider: 'claude_code',
  sessionId: 'session-1',
  context: 'work',
  cwd: '/Users/fohte/ghq/github.com/fohte/tq',
  label: 'Implement session indicator',
  lastMessage: 'Wiring up the hover card',
  customLabel: null,
  startedAt: new Date(Date.now() - 34 * 60_000).toISOString(),
  lastActiveAt: new Date(Date.now() - 2 * 60_000).toISOString(),
  endedAt: null,
}

const endedSession: TaskAgentSession = {
  ...activeSession,
  id: '2',
  sessionId: 'session-2',
  label: 'Write the release notes',
  startedAt: '2026-08-20T09:00:00Z',
  lastActiveAt: '2026-08-20T10:15:00Z',
  endedAt: '2026-08-20T10:15:00Z',
}

function SessionIndicatorStory({ sessions }: { sessions: TaskAgentSession[] }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  resetSessionOpenSettings({
    localContext: null,
    focusUrlTemplate: null,
    resumeUrlTemplate: null,
  })

  return (
    <QueryClientProvider client={queryClient}>
      <div className="dark flex items-center bg-background p-4">
        <SessionIndicator sessions={sessions} />
      </div>
    </QueryClientProvider>
  )
}

const meta = {
  title: 'AgentSession/SessionIndicator',
  component: SessionIndicatorStory,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof SessionIndicatorStory>

export default meta
type Story = StoryObj<typeof meta>

export const NoSessions: Story = {
  args: { sessions: [] },
  play: async ({ canvas }) => {
    await expect(
      canvas.queryByTestId('session-indicator'),
    ).not.toBeInTheDocument()
  },
}

export const ActiveSession: Story = {
  args: { sessions: [activeSession] },
}

export const EndedSession: Story = {
  args: { sessions: [endedSession] },
}

export const ShowsActiveWhenOneOfManyIsActive: Story = {
  args: { sessions: [endedSession, activeSession] },
}

export const OpensCardOnHover: Story = {
  args: { sessions: [activeSession, endedSession] },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.hover(canvas.getByTestId('session-indicator'))

    const body = within(canvasElement.ownerDocument.body)
    await waitFor(() => expect(body.getByText('SESSIONS (2)')).toBeVisible())
    await expect(body.getByText('Implement session indicator')).toBeVisible()
    await expect(body.getByText('Write the release notes')).toBeVisible()
  },
}
