import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import { makeMentionSuggestion } from '#components/task/task-mention-test-fixtures'
import { TaskTitleInput } from '#components/task/task-title-input'
import { taskMentionKeys } from '#hooks/use-task-mentions'

function renderTaskTitleInput(initialValue = '', queryClient?: QueryClient) {
  const client =
    queryClient ??
    new QueryClient({ defaultOptions: { queries: { retry: false } } })

  function Managed() {
    const [value, setValue] = useState(initialValue)
    return <TaskTitleInput value={value} onChange={setValue} />
  }

  return render(
    <QueryClientProvider client={client}>
      <Managed />
    </QueryClientProvider>,
  )
}

describe('TaskTitleInput', () => {
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
