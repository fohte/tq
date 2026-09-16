import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { SessionIndicator } from '#components/agent-session/session-indicator'
import {
  activeAgentSession,
  endedAgentSession,
} from '#components/agent-session/task-agent-session-test-fixtures'
import { resetSessionOpenSettings } from '#hooks/session-open-settings-test-fixtures'
import type { TaskAgentSession } from '#hooks/use-task-agent-sessions'

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
  args: { sessions: [activeAgentSession] },
}

export const EndedSession: Story = {
  args: { sessions: [endedAgentSession] },
}

export const ShowsActiveWhenOneOfManyIsActive: Story = {
  args: {
    sessions: [endedAgentSession, activeAgentSession],
    defaultOpen: true,
  },
}
