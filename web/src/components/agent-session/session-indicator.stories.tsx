import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { SessionIndicator } from '#components/agent-session/session-indicator'
import { makeTaskAgentSession } from '#components/agent-session/task-agent-session-test-fixtures'
import { resetSessionOpenSettings } from '#hooks/session-open-settings-test-fixtures'
import type { TaskAgentSession } from '#hooks/use-task-agent-sessions'

// Kept relative to `Date.now()` (not a fixed ISO literal) so this session
// keeps rendering as active (isAgentSessionActive) no matter when this story
// runs.
const activeSession: TaskAgentSession = makeTaskAgentSession({
  id: '1',
  taskTitle: 'Sample task',
  label: 'Implement session indicator',
  lastMessage: 'Wiring up the hover card',
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

function SessionIndicatorStory({
  sessions,
  defaultOpen,
}: {
  sessions: TaskAgentSession[]
  defaultOpen?: boolean | undefined
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  resetSessionOpenSettings({
    localContext: 'work',
    focusUrlTemplate: null,
    resumeUrlTemplate: null,
  })

  return (
    <QueryClientProvider client={queryClient}>
      <div className="dark flex items-center border border-border bg-background p-4">
        <SessionIndicator sessions={sessions} defaultOpen={defaultOpen} />
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
}

export const ActiveSession: Story = {
  args: { sessions: [activeSession] },
}

export const EndedSession: Story = {
  args: { sessions: [endedSession] },
}

export const ShowsActiveWhenOneOfManyIsActive: Story = {
  args: { sessions: [endedSession, activeSession], defaultOpen: true },
}
