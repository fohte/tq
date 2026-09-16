import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { SidebarRecurrenceField } from '#components/task/sidebar-recurrence-field'
import { useUpdateTaskRecurrenceRule } from '#hooks/use-tasks'
import type { RecurrenceRule } from '#lib/recurrence'
import { clickSelectOption, partialMutation } from '#lib/test-utils'

vi.mock('#hooks/use-tasks', async (importOriginal) => {
  const original = await importOriginal<typeof import('#hooks/use-tasks')>()
  return {
    ...original,
    useUpdateTaskRecurrenceRule: vi.fn(),
  }
})

const mockUseUpdateTaskRecurrenceRule = vi.mocked(useUpdateTaskRecurrenceRule)

type UpdateRecurrenceRuleResult = ReturnType<typeof useUpdateTaskRecurrenceRule>

const taskId = '00000000-0000-0000-0000-000000000001'
const dueDate = '2026-03-25'

const weeklyRule: RecurrenceRule = {
  type: 'weekly',
  interval: 1,
  daysOfWeek: [0, 3],
}

const customRule: RecurrenceRule = {
  type: 'custom',
  interval: 3,
}

describe('SidebarRecurrenceField', () => {
  it('saves a weekly rule with a selected weekday', async () => {
    const mutate = vi.fn<UpdateRecurrenceRuleResult['mutate']>()
    mockUseUpdateTaskRecurrenceRule.mockReturnValue(
      partialMutation<UpdateRecurrenceRuleResult>({ mutate }),
    )
    const user = userEvent.setup()
    render(
      <SidebarRecurrenceField
        taskId={taskId}
        dueDate={dueDate}
        recurrenceRule={null}
        templateId={null}
      />,
    )

    await user.click(screen.getByText('—'))
    await user.click(screen.getByRole('combobox'))
    await clickSelectOption(
      user,
      await screen.findByRole('option', { name: 'Weekly' }),
    )
    await user.click(screen.getByText('W'))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(mutate).toHaveBeenCalledWith({
      id: taskId,
      recurrenceRule: { type: 'weekly', interval: 1, daysOfWeek: [3] },
    })
  })

  it('saves a monthly rule with a day of month', async () => {
    const mutate = vi.fn<UpdateRecurrenceRuleResult['mutate']>()
    mockUseUpdateTaskRecurrenceRule.mockReturnValue(
      partialMutation<UpdateRecurrenceRuleResult>({ mutate }),
    )
    const user = userEvent.setup()
    render(
      <SidebarRecurrenceField
        taskId={taskId}
        dueDate={dueDate}
        recurrenceRule={null}
        templateId={null}
      />,
    )

    await user.click(screen.getByText('—'))
    await user.click(screen.getByRole('combobox'))
    await clickSelectOption(
      user,
      await screen.findByRole('option', { name: 'Monthly' }),
    )
    await user.type(screen.getByPlaceholderText('Day of month (1-31)'), '10')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(mutate).toHaveBeenCalledWith({
      id: taskId,
      recurrenceRule: { type: 'monthly', interval: 1, dayOfMonth: 10 },
    })
  })

  it('saves a rule parsed from shorthand input', async () => {
    const mutate = vi.fn<UpdateRecurrenceRuleResult['mutate']>()
    mockUseUpdateTaskRecurrenceRule.mockReturnValue(
      partialMutation<UpdateRecurrenceRuleResult>({ mutate }),
    )
    const user = userEvent.setup()
    render(
      <SidebarRecurrenceField
        taskId={taskId}
        dueDate={dueDate}
        recurrenceRule={null}
        templateId={null}
      />,
    )

    await user.click(screen.getByText('—'))
    await user.type(
      screen.getByPlaceholderText('*weekly, *sun, *毎週 ...'),
      '*sun',
    )
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(mutate).toHaveBeenCalledWith({
      id: taskId,
      recurrenceRule: { type: 'weekly', interval: 1, daysOfWeek: [0] },
    })
  })

  it('clears an existing rule back to None', async () => {
    const mutate = vi.fn<UpdateRecurrenceRuleResult['mutate']>()
    mockUseUpdateTaskRecurrenceRule.mockReturnValue(
      partialMutation<UpdateRecurrenceRuleResult>({ mutate }),
    )
    const user = userEvent.setup()
    render(
      <SidebarRecurrenceField
        taskId={taskId}
        dueDate={dueDate}
        recurrenceRule={weeklyRule}
        templateId={null}
      />,
    )

    await user.click(screen.getByText('Weekly · Sun, Wed'))
    await user.click(screen.getByRole('combobox'))
    await clickSelectOption(
      user,
      await screen.findByRole('option', { name: 'None' }),
    )
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(mutate).toHaveBeenCalledWith({ id: taskId, recurrenceRule: null })
  })

  it('keeps Save disabled for a custom rule until something changes', async () => {
    mockUseUpdateTaskRecurrenceRule.mockReturnValue(
      partialMutation<UpdateRecurrenceRuleResult>({ mutate: vi.fn() }),
    )
    const user = userEvent.setup()
    render(
      <SidebarRecurrenceField
        taskId={taskId}
        dueDate={dueDate}
        recurrenceRule={customRule}
        templateId={null}
      />,
    )

    // A 'custom' rule (only reachable via the API/MCP, never created by
    // this UI) has no matching Select option, so opening the editor starts
    // the draft at 'None' with nothing else changed. Regression test for a
    // bug where Save was enabled immediately in this state, silently
    // clearing the custom rule on a single click.
    await user.click(screen.getByText('Custom · every 3 days'))

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })
})
