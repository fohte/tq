import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SessionRow } from '#components/agent-session/session-row'
import { resetSessionOpenSettings } from '#hooks/session-open-settings-test-fixtures'
import type { AgentSession } from '#hooks/use-agent-sessions'
import { useUpdateAgentSessionCustomLabel } from '#hooks/use-agent-sessions'
import type { SessionOpenSettings } from '#lib/session-open'
import { partialMutation } from '#lib/test-utils'

vi.mock('#hooks/use-agent-sessions', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('#hooks/use-agent-sessions')>()
  return { ...original, useUpdateAgentSessionCustomLabel: vi.fn() }
})

const mockUseUpdateAgentSessionCustomLabel = vi.mocked(
  useUpdateAgentSessionCustomLabel,
)
type UpdateCustomLabelResult = ReturnType<
  typeof useUpdateAgentSessionCustomLabel
>

const baseSession: AgentSession = {
  id: '1',
  provider: 'claude_code',
  sessionId: 'session-1',
  parentSessionId: null,
  context: 'work',
  cwd: '/Users/fohte/ghq/github.com/fohte/tq',
  label: 'web sessions page',
  lastMessage: 'Implement the sessions list page',
  customLabel: null,
  startedAt: new Date(Date.now() - 34 * 60_000).toISOString(),
  lastActiveAt: new Date(Date.now() - 2 * 60_000).toISOString(),
  endedAt: null,
}

function renderSessionRow(
  props: Partial<ComponentProps<typeof SessionRow>> = {},
  settings: Partial<SessionOpenSettings> = {},
) {
  resetSessionOpenSettings({
    localContext: 'work',
    focusUrlTemplate: null,
    resumeUrlTemplate: null,
    ...settings,
  })
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <SessionRow session={baseSession} isDimmed={false} {...props} />
    </QueryClientProvider>,
  )
}

describe('SessionRow', () => {
  // EditableSessionLabel reads `useUpdateAgentSessionCustomLabel()` on every
  // render (not just while editing), and a focused textbox blurs — and so
  // saves — when a test's cleanup() unmounts it. Without a default mock
  // return, that unrelated save crashes on `.mutate` of undefined.
  beforeEach(() => {
    mockUseUpdateAgentSessionCustomLabel.mockReturnValue(
      partialMutation<UpdateCustomLabelResult>({
        mutate: vi.fn(),
        isPending: false,
        isError: false,
      }),
    )
  })

  describe('label editing', () => {
    it('switches the label to an editable textbox on click, prefilled with the current value', async () => {
      const { container } = renderSessionRow()
      const user = userEvent.setup()
      const canvas = within(container)

      await user.click(canvas.getByText(baseSession.label ?? ''))

      expect(canvas.getByRole('textbox')).toHaveValue(baseSession.label)
    })

    it('saves the edited label on Enter', async () => {
      const mutate = vi.fn()
      mockUseUpdateAgentSessionCustomLabel.mockReturnValue(
        partialMutation<UpdateCustomLabelResult>({
          mutate,
          isPending: false,
          isError: false,
        }),
      )
      const { container } = renderSessionRow({
        session: { ...baseSession, id: '8' },
      })
      const user = userEvent.setup()
      const canvas = within(container)

      await user.click(canvas.getByText(baseSession.label ?? ''))
      const input = canvas.getByRole('textbox')
      await user.clear(input)
      await user.type(input, 'renamed session')
      await user.keyboard('{Enter}')

      expect(mutate).toHaveBeenCalledWith({
        id: '8',
        customLabel: 'renamed session',
      })
    })

    it('clears the custom label when saved empty', async () => {
      const mutate = vi.fn()
      mockUseUpdateAgentSessionCustomLabel.mockReturnValue(
        partialMutation<UpdateCustomLabelResult>({
          mutate,
          isPending: false,
          isError: false,
        }),
      )
      const { container } = renderSessionRow({
        session: { ...baseSession, id: '10' },
      })
      const user = userEvent.setup()
      const canvas = within(container)

      await user.click(canvas.getByText(baseSession.label ?? ''))
      await user.clear(canvas.getByRole('textbox'))
      await user.keyboard('{Enter}')

      expect(mutate).toHaveBeenCalledWith({ id: '10', customLabel: null })
    })

    it('discards the edit and reverts to the original label on Escape', async () => {
      const mutate = vi.fn()
      mockUseUpdateAgentSessionCustomLabel.mockReturnValue(
        partialMutation<UpdateCustomLabelResult>({
          mutate,
          isPending: false,
          isError: false,
        }),
      )
      const { container } = renderSessionRow({
        session: { ...baseSession, id: '9' },
      })
      const user = userEvent.setup()
      const canvas = within(container)

      await user.click(canvas.getByText(baseSession.label ?? ''))
      const input = canvas.getByRole('textbox')
      await user.clear(input)
      await user.type(input, 'discarded edit')
      await user.keyboard('{Escape}')

      expect(canvas.getByText(baseSession.label ?? '')).toBeInTheDocument()
      expect(mutate).not.toHaveBeenCalled()
    })
  })

  describe('focus/resume button', () => {
    it('copies the resume command to the clipboard when Focus is clicked', async () => {
      const writeText = vi
        .spyOn(navigator.clipboard, 'writeText')
        .mockResolvedValue(undefined)
      const { container } = renderSessionRow({
        session: { ...baseSession, id: '11' },
      })
      const user = userEvent.setup()
      const button = within(container).getByRole('button', {
        name: 'Focus session',
      })

      await user.click(button)

      expect(writeText).toHaveBeenCalledWith("claude --resume 'session-1'")
    })

    it('shows copied feedback after a successful copy', async () => {
      vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined)
      const { container } = renderSessionRow({
        session: { ...baseSession, id: '15' },
      })
      const user = userEvent.setup()
      const button = within(container).getByRole('button', {
        name: 'Focus session',
      })

      await user.click(button)

      await waitFor(() => expect(button).toHaveAttribute('title', 'Copied'))
    })

    it('shows a failure state when the copy rejects', async () => {
      vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(
        new Error('denied'),
      )
      const { container } = renderSessionRow({
        session: { ...baseSession, id: '14' },
      })
      const user = userEvent.setup()
      const button = within(container).getByRole('button', {
        name: 'Focus session',
      })

      await user.click(button)

      await waitFor(() =>
        expect(button).toHaveAttribute('title', 'Copy failed — see console'),
      )
    })

    it('renders no Focus/Resume button when the session context does not match the local context', () => {
      const { container } = renderSessionRow(
        { session: { ...baseSession, id: '12' } },
        { localContext: 'personal' },
      )

      expect(
        within(container).queryByRole('button', {
          name: /Focus session|Resume session/,
        }),
      ).not.toBeInTheDocument()
    })

    it('shows the resolved URL in the button title when a focus URL template is configured', () => {
      const { container } = renderSessionRow(
        { session: { ...baseSession, id: '13' } },
        { focusUrlTemplate: 'hammerspoon://cc-focus?session={sessionId}' },
      )

      const button = within(container).getByRole('button', {
        name: 'Focus session',
      })

      expect(button).toHaveAttribute(
        'title',
        'Open: hammerspoon://cc-focus?session=session-1',
      )
    })
  })
})
