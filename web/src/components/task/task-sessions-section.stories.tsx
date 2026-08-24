import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { TaskSessionsList } from '#components/task/task-sessions-section'
import type { AgentSession } from '#hooks/use-agent-sessions'
import { StoryRouter } from '#storybook-config/story-router'

// Kept relative to `Date.now()` (not a fixed ISO literal) so the active
// session keeps rendering as active (isAgentSessionActive) no matter when
// this story runs.
const activeSession: AgentSession = {
  id: '1',
  provider: 'claude_code',
  sessionId: 'session-1',
  context: 'work',
  cwd: '/Users/fohte/ghq/github.com/tq',
  label: 'Add agent session list view',
  lastMessage: 'Implement the sessions list page',
  customLabel: null,
  startedAt: new Date(Date.now() - 34 * 60_000).toISOString(),
  lastActiveAt: new Date(Date.now() - 2 * 60_000).toISOString(),
  endedAt: null,
}

const endedSession: AgentSession = {
  ...activeSession,
  id: '2',
  label: 'Wire up task-agent-session linking',
  startedAt: '2026-08-20T09:00:00Z',
  lastActiveAt: '2026-08-20T10:15:00Z',
  endedAt: '2026-08-20T10:15:00Z',
}

function Providers({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return (
    <QueryClientProvider client={queryClient}>
      <StoryRouter
        component={() => <>{children}</>}
        paths={['/tasks/$taskId']}
      />
    </QueryClientProvider>
  )
}

function SectionStory({ sessions }: { sessions: AgentSession[] }) {
  return (
    <Providers>
      <div className="max-w-2xl p-6">
        <TaskSessionsList sessions={sessions} />
      </div>
    </Providers>
  )
}

const meta = {
  title: 'Task/Sessions/Section',
  component: SectionStory,
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof SectionStory>

export default meta
type SectionStoryType = StoryObj<typeof meta>

export const WithSessions: SectionStoryType = {
  args: { sessions: [activeSession, endedSession] },
}

export const Empty: SectionStoryType = {
  args: { sessions: [] },
}
