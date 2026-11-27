import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { makeProjectField } from '#components/project/project-test-fixtures'
import { SidebarCustomField } from '#components/task/sidebar-custom-field'
import { useUpdateTask } from '#hooks/use-tasks'
import { clickSelectOption, partialMutation } from '#lib/test-utils'

vi.mock('#hooks/use-tasks', async (importOriginal) => {
  const original = await importOriginal<typeof import('#hooks/use-tasks')>()
  return { ...original, useUpdateTask: vi.fn() }
})

const mockUseUpdateTask = vi.mocked(useUpdateTask)
const taskId = '00000000-0000-0000-0000-000000000001'
const field = makeProjectField({
  id: 'field-stage',
  name: 'DeliveryStage',
  options: [
    { id: 'option-triage', name: 'Triage' },
    { id: 'option-review', name: 'Review' },
  ],
})

function renderSidebarField(optionId: string | undefined) {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <SidebarCustomField taskId={taskId} field={field} optionId={optionId} />
    </QueryClientProvider>,
  )
}

describe('SidebarCustomField', () => {
  it('saves the selected option by field and option IDs', async () => {
    const mutate = vi.fn<ReturnType<typeof useUpdateTask>['mutate']>()
    mockUseUpdateTask.mockReturnValue(
      partialMutation<ReturnType<typeof useUpdateTask>>({ mutate }),
    )
    const user = userEvent.setup({
      pointerEventsCheck: PointerEventsCheckLevel.Never,
    })
    renderSidebarField(field.options[0]?.id)

    await user.click(screen.getByRole('combobox', { name: field.name }))
    await clickSelectOption(
      user,
      await screen.findByRole('option', { name: 'Review' }),
    )

    expect(mutate.mock.calls).toEqual([
      [{ id: taskId, input: { fieldValues: { [field.id]: 'option-review' } } }],
    ])
  })

  it('clears the field when the dash option is selected', async () => {
    const mutate = vi.fn<ReturnType<typeof useUpdateTask>['mutate']>()
    mockUseUpdateTask.mockReturnValue(
      partialMutation<ReturnType<typeof useUpdateTask>>({ mutate }),
    )
    const user = userEvent.setup({
      pointerEventsCheck: PointerEventsCheckLevel.Never,
    })
    renderSidebarField(field.options[0]?.id)

    await user.click(screen.getByRole('combobox', { name: field.name }))
    await clickSelectOption(
      user,
      await screen.findByRole('option', { name: '—' }),
    )

    expect(mutate.mock.calls).toEqual([
      [{ id: taskId, input: { fieldValues: { [field.id]: null } } }],
    ])
  })
})
