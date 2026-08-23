import type { Meta, StoryObj } from '@storybook/react-vite'

import { SessionRow } from '#components/agent-session/session-row'
import type { AgentSession } from '#hooks/use-agent-sessions'

// Kept relative to `Date.now()` (not a fixed ISO literal) so this session
// keeps rendering as active (isAgentSessionActive) no matter when this story
// runs.
const baseSession: AgentSession = {
  id: '1',
  provider: 'claude_code',
  sessionId: 'session-1',
  context: 'work',
  cwd: '/Users/fohte/ghq/github.com/fohte/tq',
  label: 'web sessions page',
  lastMessage: 'Implement the sessions list page',
  customLabel: null,
  startedAt: new Date(Date.now() - 34 * 60_000).toISOString(),
  lastActiveAt: new Date(Date.now() - 2 * 60_000).toISOString(),
  endedAt: null,
}

function SessionRowStory(props: React.ComponentProps<typeof SessionRow>) {
  return (
    <div className="dark w-3xl bg-background">
      <SessionRow {...props} />
    </div>
  )
}

const meta = {
  title: 'AgentSession/SessionRow',
  component: SessionRowStory,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof SessionRowStory>

export default meta
type Story = StoryObj<typeof meta>

export const Active: Story = {
  args: {
    session: baseSession,
    isDimmed: false,
  },
}

export const ActiveDimmed: Story = {
  args: {
    session: { ...baseSession, id: '2', context: 'personal' },
    isDimmed: true,
  },
}

export const Ended: Story = {
  args: {
    session: {
      ...baseSession,
      id: '3',
      startedAt: '2026-08-20T09:00:00Z',
      lastActiveAt: '2026-08-20T10:15:00Z',
      endedAt: '2026-08-20T10:15:00Z',
    },
    isDimmed: false,
  },
}

export const EndedDimmed: Story = {
  args: {
    session: {
      ...baseSession,
      id: '4',
      context: 'personal',
      startedAt: '2026-08-20T09:00:00Z',
      lastActiveAt: '2026-08-20T10:15:00Z',
      endedAt: '2026-08-20T10:15:00Z',
    },
    isDimmed: true,
  },
}

export const NoLabel: Story = {
  args: {
    session: { ...baseSession, id: '5', label: null, customLabel: null },
    isDimmed: false,
  },
}

export const LongCwdAndLabel: Story = {
  args: {
    session: {
      ...baseSession,
      id: '6',
      cwd: '/Users/fohte/ghq/github.com/fohte/tq/.worktrees/some-very-long-worktree-directory-name-for-a-feature-branch',
      label:
        'a very long session label describing exactly what this agent session is working on right now',
    },
    isDimmed: false,
  },
}
