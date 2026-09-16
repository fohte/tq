import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { makeLabel } from '#components/label/label-test-fixtures'
import { TaskLabelFilterFields } from '#components/task/task-label-filter-fields'
import { resetSessionOpenSettings } from '#hooks/session-open-settings-test-fixtures'
import { labelKeys } from '#hooks/use-labels'

function renderFields(selectedLabel?: string) {
  // useCurrentContext() reads localStorage, which persists across test
  // files in browser mode — pin it so the seeded labelKeys.list context
  // always matches.
  resetSessionOpenSettings({ localContext: 'personal' })
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  queryClient.setQueryData(labelKeys.list({ context: 'personal' }), [
    makeLabel({ id: '1', name: 'dev/tq' }),
    makeLabel({ id: '2', name: 'dev/infra' }),
    makeLabel({ id: '3', name: 'chore' }),
  ])
  const onLabelChange = vi.fn()
  render(
    <QueryClientProvider client={queryClient}>
      <TaskLabelFilterFields
        selectedLabel={selectedLabel}
        onLabelChange={onLabelChange}
      />
    </QueryClientProvider>,
  )
  return onLabelChange
}

describe('TaskLabelFilterFields', () => {
  it('selects a leaf label', async () => {
    const onLabelChange = renderFields()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: '#chore' }))

    expect(onLabelChange).toHaveBeenCalledWith('chore')
  })

  it('selects a nested label', async () => {
    const onLabelChange = renderFields()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: '#tq' }))

    expect(onLabelChange).toHaveBeenCalledWith('dev/tq')
  })

  it('selects a synthesized parent label', async () => {
    const onLabelChange = renderFields()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: '#dev' }))

    expect(onLabelChange).toHaveBeenCalledWith('dev')
  })

  it('clears the selected label', async () => {
    const onLabelChange = renderFields('dev/tq')
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'No label' }))

    expect(onLabelChange).toHaveBeenCalledWith(undefined)
  })
})
