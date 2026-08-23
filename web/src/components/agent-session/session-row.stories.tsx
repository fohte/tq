import type { Meta, StoryObj } from '@storybook/react-vite'

import { SessionRow } from '#components/agent-session/session-row'
import type { AgentSession } from '#hooks/use-agent-sessions'

const baseSession: AgentSession = {
  id: '1',
  provider: 'claude_code',
  sessionId: 'session-1',
  context: 'work',
  cwd: '/Users/fohte/ghq/github.com/fohte/tq',
  label: 'web sessions page',
  lastMessage: 'Implement the sessions list page',
  customLabel: null,
  startedAt: '2026-08-23T09:00:00Z',
  lastActiveAt: '2026-08-23T09:32:00Z',
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

export const AllVariants: Story = {
  args: { session: baseSession, isDimmed: false },
  render: () => {
    const sessions: { session: AgentSession; isDimmed: boolean }[] = [
      { session: baseSession, isDimmed: false },
      {
        session: { ...baseSession, id: '2', context: 'personal' },
        isDimmed: true,
      },
      {
        session: {
          ...baseSession,
          id: '3',
          startedAt: '2026-08-20T09:00:00Z',
          lastActiveAt: '2026-08-20T10:15:00Z',
          endedAt: '2026-08-20T10:15:00Z',
        },
        isDimmed: false,
      },
      {
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
      {
        session: { ...baseSession, id: '5', label: null, customLabel: null },
        isDimmed: false,
      },
    ]

    return (
      <div className="dark w-3xl divide-y divide-border bg-background">
        {sessions.map(({ session, isDimmed }) => (
          <SessionRow key={session.id} session={session} isDimmed={isDimmed} />
        ))}
      </div>
    )
  },
}
