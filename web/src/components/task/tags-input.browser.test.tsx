import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import { makeLabel } from '#components/label/label-test-fixtures'
import { TagsInput } from '#components/task/tags-input'
import { labelKeys } from '#hooks/use-labels'

function renderTagsInput(initialLabels: string[] = []) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  function Managed() {
    const [labels, setLabels] = useState(initialLabels)
    return <TagsInput labels={labels} onLabelsChange={setLabels} />
  }

  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <Managed />
      </QueryClientProvider>,
    ),
  }
}

describe('TagsInput', () => {
  it('opens the input on "+ add tag" click', async () => {
    const user = userEvent.setup()
    renderTagsInput()

    await user.click(screen.getByRole('button', { name: '+ add tag' }))

    expect(screen.getByPlaceholderText('tag name')).toBeInTheDocument()
  })

  it('adds a new tag on Enter', async () => {
    const user = userEvent.setup()
    renderTagsInput()

    await user.click(screen.getByRole('button', { name: '+ add tag' }))
    await user.type(screen.getByPlaceholderText('tag name'), 'urgent')
    await user.keyboard('{Enter}')

    expect(screen.getByText('urgent')).toBeInTheDocument()
  })

  it('shows suggestions without losing focus', async () => {
    const user = userEvent.setup()
    const { queryClient } = renderTagsInput()
    queryClient.setQueryData(labelKeys.list({ context: 'personal' }), [
      makeLabel({ id: '1', name: 'urgent' }),
    ])

    await user.click(screen.getByRole('button', { name: '+ add tag' }))
    const input = screen.getByPlaceholderText('tag name')
    await user.type(input, 'urg')

    expect(await screen.findByText('#urgent')).toBeVisible()
    expect(input).toHaveFocus()
  })

  it('adds a tag by clicking a suggestion', async () => {
    const user = userEvent.setup()
    const { queryClient } = renderTagsInput()
    queryClient.setQueryData(labelKeys.list({ context: 'personal' }), [
      makeLabel({ id: '1', name: 'dev/tq' }),
    ])

    await user.click(screen.getByRole('button', { name: '+ add tag' }))
    const suggestion = await screen.findByText('#tq')
    await user.click(suggestion)

    expect(screen.getByText('dev/tq')).toBeInTheDocument()
  })

  it('removes a tag on click', async () => {
    const user = userEvent.setup()
    renderTagsInput(['urgent'])

    await user.click(screen.getByRole('button', { name: 'Remove urgent' }))

    expect(screen.queryByText('urgent')).not.toBeInTheDocument()
  })
})
