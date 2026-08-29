import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { expect, spyOn, userEvent, waitFor, within } from 'storybook/test'

import { SessionRow } from '#components/agent-session/session-row'
import { resetSessionOpenSettings } from '#hooks/session-open-settings-test-fixtures'
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

function SessionRowStory({
  localContext,
  focusUrlTemplate,
  resumeUrlTemplate,
  ...props
}: React.ComponentProps<typeof SessionRow> & {
  // Seeds the same localStorage key `useSessionOpenSettings` reads, reset on
  // every render so stories stay deterministic regardless of run order.
  localContext?: 'work' | 'personal' | undefined
  focusUrlTemplate?: string | undefined
  resumeUrlTemplate?: string | undefined
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  resetSessionOpenSettings({
    localContext: localContext ?? null,
    focusUrlTemplate: focusUrlTemplate ?? null,
    resumeUrlTemplate: resumeUrlTemplate ?? null,
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
    // The row's label reverts to `label ?? ''` from props (not the mutation
    // response) once editing stops, so this renders identically to Active —
    // the play only proves the PATCH body, not a distinct look.
    screenshot: { skip: true },
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

export const ClearsLabelOnEmptyInput: Story = {
  args: {
    session: { ...baseSession, id: '10' },
    isDimmed: false,
  },
  parameters: {
    // The row's label reverts to `label ?? ''` from props (not the mutation
    // response) once editing stops, so this renders identically to Active —
    // the play only proves the PATCH body, not a distinct look.
    screenshot: { skip: true },
    msw: {
      handlers: [
        http.patch('/api/agent-sessions/:id', async ({ request }) => {
          patchedBody = await request.json()
          return HttpResponse.json({ ...baseSession, customLabel: null })
        }),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    patchedBody = null
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByText(baseSession.label ?? ''))
    await userEvent.clear(canvas.getByRole('textbox'))
    await userEvent.keyboard('{Enter}')

    await waitFor(async () => {
      await expect(patchedBody).toEqual({ customLabel: null })
    })
  },
}

export const CancelsEditOnEscape: Story = {
  args: {
    session: { ...baseSession, id: '9' },
    isDimmed: false,
  },
  parameters: {
    // Escape reverts the label button to its pre-edit text, identical to
    // Active's rendered row — the play only proves the cancel behavior, not
    // a distinct look.
    screenshot: { skip: true },
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

export const CopiesResumeCommandOnClick: Story = {
  args: {
    session: { ...baseSession, id: '11' },
    isDimmed: false,
  },
  parameters: {
    // The transient copied state is not waited on, making screenshot
    // capture timing nondeterministic.
    screenshot: { skip: true },
  },
  play: async ({ canvas }) => {
    // Headless Chromium denies the clipboard-write permission by default, so
    // this stubs it out rather than exercising a real write.
    const writeText = spyOn(navigator.clipboard, 'writeText').mockResolvedValue(
      undefined,
    )

    const button = canvas.getByRole('button', { name: 'Focus session' })
    await userEvent.click(button)

    await expect(writeText).toHaveBeenCalledWith("claude --resume 'session-1'")
  },
}

export const ShowsCopiedFeedbackAfterCopy: Story = {
  args: {
    session: { ...baseSession, id: '15' },
    isDimmed: false,
  },
  parameters: {
    // The copied state reverts to idle after COPY_FEEDBACK_MS, and a slow CI
    // run can cross that window before the screenshot is taken — skip the
    // capture since the play function already asserts the feedback state.
    screenshot: { skip: true },
  },
  play: async ({ canvas }) => {
    spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined)

    const button = canvas.getByRole('button', { name: 'Focus session' })
    await userEvent.click(button)

    await waitFor(() => expect(button).toHaveAttribute('title', 'Copied'))
  },
}

export const ShowsFailureWhenCopyRejects: Story = {
  args: {
    session: { ...baseSession, id: '14' },
    isDimmed: false,
  },
  parameters: {
    // Same COPY_FEEDBACK_MS timeout as ShowsCopiedFeedbackAfterCopy — skip
    // the capture for the same reason.
    screenshot: { skip: true },
  },
  play: async ({ canvas }) => {
    spyOn(navigator.clipboard, 'writeText').mockRejectedValue(
      new Error('denied'),
    )

    const button = canvas.getByRole('button', { name: 'Focus session' })
    await userEvent.click(button)

    await waitFor(() =>
      expect(button).toHaveAttribute('title', 'Copy failed — see console'),
    )
  },
}

export const NotOpenableFromAnotherContext: Story = {
  args: {
    session: { ...baseSession, id: '12' },
    isDimmed: false,
    localContext: 'personal',
  },
  play: async ({ canvas }) => {
    await expect(
      canvas.queryByRole('button', { name: /Focus session|Resume session/ }),
    ).not.toBeInTheDocument()
  },
}

export const OpensConfiguredUrlTemplate: Story = {
  args: {
    session: { ...baseSession, id: '13' },
    isDimmed: false,
    focusUrlTemplate: 'hammerspoon://cc-focus?session={sessionId}',
  },
  parameters: {
    // The play asserts the button's `title` attribute, a tooltip that isn't
    // rendered in the screenshot — the row looks identical to Active.
    screenshot: { skip: true },
  },
  play: async ({ canvas }) => {
    // Doesn't click — clicking would assign `window.location.href` and
    // navigate the story away. The button's title already shows exactly
    // what a click would open, which is enough to prove the template was
    // picked and expanded correctly.
    const button = canvas.getByRole('button', { name: 'Focus session' })

    await expect(button).toHaveAttribute(
      'title',
      'Open: hammerspoon://cc-focus?session=session-1',
    )
  },
}
