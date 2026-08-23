import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { expect, userEvent, waitFor, within } from 'storybook/test'

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
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return (
    <QueryClientProvider client={queryClient}>
      <div className="dark w-3xl bg-background">
        <SessionRow {...props} />
      </div>
    </QueryClientProvider>
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

export const EditingLabel: Story = {
  args: {
    session: { ...baseSession, id: '7' },
    isDimmed: false,
  },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByText(baseSession.label ?? ''))

    await expect(canvas.getByRole('textbox')).toHaveValue(baseSession.label)
  },
}

let patchedBody: unknown = null

export const SavesEditedLabelOnEnter: Story = {
  args: {
    session: { ...baseSession, id: '8' },
    isDimmed: false,
  },
  parameters: {
    msw: {
      handlers: [
        http.patch('/api/agent-sessions/:id', async ({ request }) => {
          patchedBody = await request.json()
          return HttpResponse.json({
            ...baseSession,
            customLabel: 'renamed session',
          })
        }),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    patchedBody = null
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByText(baseSession.label ?? ''))
    const input = canvas.getByRole('textbox')
    await userEvent.clear(input)
    await userEvent.type(input, 'renamed session')
    await userEvent.keyboard('{Enter}')

    await waitFor(async () => {
      await expect(patchedBody).toEqual({ customLabel: 'renamed session' })
    })
  },
}

export const CancelsEditOnEscape: Story = {
  args: {
    session: { ...baseSession, id: '9' },
    isDimmed: false,
  },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByText(baseSession.label ?? ''))
    const input = canvas.getByRole('textbox')
    await userEvent.clear(input)
    await userEvent.type(input, 'discarded edit')
    await userEvent.keyboard('{Escape}')

    // No msw handler is registered for this story, so a PATCH request here
    // would fail the story via the unhandled-request check in preview.tsx.
    await expect(canvas.getByText(baseSession.label ?? '')).toBeInTheDocument()
  },
}
