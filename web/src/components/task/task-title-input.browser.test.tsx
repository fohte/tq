import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import { seedContextLabels } from '#components/label/label-test-fixtures'
import { makeMentionSuggestion } from '#components/task/task-mention-test-fixtures'
import { TaskTitleInput } from '#components/task/task-title-input'
import { resetSessionOpenSettings } from '#hooks/session-open-settings-test-fixtures'
import { taskMentionKeys } from '#lib/query-keys'

function renderTaskTitleInput(
  initialValue = '',
  queryClient?: QueryClient,
  context?: 'work' | 'personal' | '',
) {
  const client =
    queryClient ??
    new QueryClient({ defaultOptions: { queries: { retry: false } } })

  function Managed() {
    const [value, setValue] = useState(initialValue)
    return (
      <TaskTitleInput value={value} onChange={setValue} context={context} />
    )
  }

  return render(
    <QueryClientProvider client={client}>
      <Managed />
    </QueryClientProvider>,
  )
}

describe('TaskTitleInput', () => {
  it('uses the current context when no label context is selected', async () => {
    resetSessionOpenSettings({ localContext: 'work' })
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    })
    seedContextLabels(queryClient)
    const user = userEvent.setup()
    renderTaskTitleInput('', queryClient, '')

    await user.type(screen.getByRole('textbox'), '#')

    await waitFor(() => {
      expect(
        screen
          .getAllByRole('button', { name: /^#/ })
          .map((button) => button.innerText),
      ).toEqual(['#work-only'])
    })
  })

  it('selects a suggestion on Enter, replacing the partial token', async () => {
    const user = userEvent.setup()
    renderTaskTitleInput()

    const input = screen.getByRole('textbox')
    await user.type(input, 'Buy milk @30')
    await expect(screen.findByText('@30m')).resolves.toBeVisible()

    await user.keyboard('{Enter}')

    expect(input).toHaveValue('Buy milk @30m ')
    expect(screen.queryByText('@30m')).not.toBeInTheDocument()
  })

  it('selects a parent suggestion on Enter, replacing the partial token', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    })
    // useTaskMentionSuggestions debounces 150ms, and each digit of '^12'
    // lands as its own keystroke event — in this real-browser test
    // environment that's consistently enough to settle its own debounced
    // value, so '', '1', and '12' each fire their own query. Seed every
    // partial, or an un-cached key falls through to a real (failing)
    // network fetch.
    queryClient.setQueryData(taskMentionKeys.suggestions(''), [])
    queryClient.setQueryData(taskMentionKeys.suggestions('1'), [])
    queryClient.setQueryData(taskMentionKeys.suggestions('12'), [
      makeMentionSuggestion({ number: 12, title: 'Deploy to production' }),
    ])
    const user = userEvent.setup()
    renderTaskTitleInput('', queryClient)

    const input = screen.getByRole('textbox')
    await user.type(input, 'Buy milk ^12')
    await expect(
      screen.findByText('Deploy to production'),
    ).resolves.toBeVisible()

    await user.keyboard('{Enter}')

    expect(input).toHaveValue('Buy milk ^12 ')
    expect(screen.queryByText('Deploy to production')).not.toBeInTheDocument()
  })

  it('closes the menu on Escape without clearing the typed text', async () => {
    const user = userEvent.setup()
    renderTaskTitleInput()

    const input = screen.getByRole('textbox')
    await user.type(input, 'Buy milk @')
    await expect(screen.findByText('@today')).resolves.toBeVisible()

    await user.keyboard('{Escape}')

    expect(screen.queryByText('@today')).not.toBeInTheDocument()
    expect(input).toHaveValue('Buy milk @')
  })
})
