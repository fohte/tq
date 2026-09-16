import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { TemplateRepeatField } from '#components/recurring/template-repeat-field'
import { useUpdateRecurringTemplate } from '#hooks/use-recurring-templates'
import type { RecurrenceRule } from '#lib/recurrence'
import { partialMutation } from '#lib/test-utils'

vi.mock('#hooks/use-recurring-templates', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('#hooks/use-recurring-templates')>()
  return {
    ...original,
    useUpdateRecurringTemplate: vi.fn(),
  }
})

const mockUseUpdateRecurringTemplate = vi.mocked(useUpdateRecurringTemplate)

type UpdateRecurringTemplateResult = ReturnType<
  typeof useUpdateRecurringTemplate
>

const templateId = '00000000-0000-0000-0000-000000000001'
const anchorDate = '2026-03-20'

const weeklyRule: RecurrenceRule = {
  type: 'weekly',
  interval: 1,
  daysOfWeek: [0, 3],
}

describe('TemplateRepeatField', () => {
  it('disables Save until the draft changes', async () => {
    mockUseUpdateRecurringTemplate.mockReturnValue(
      partialMutation<UpdateRecurringTemplateResult>({ mutate: vi.fn() }),
    )
    const user = userEvent.setup()
    render(
      <TemplateRepeatField
        templateId={templateId}
        recurrenceRule={weeklyRule}
        lastGeneratedDate={null}
        anchorDate={anchorDate}
      />,
    )

    await user.click(screen.getByText('Weekly · Sun, Wed'))

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('saves the draft with the newly picked weekday added', async () => {
    const mutate = vi.fn()
    mockUseUpdateRecurringTemplate.mockReturnValue(
      partialMutation<UpdateRecurringTemplateResult>({ mutate }),
    )
    const user = userEvent.setup()
    render(
      <TemplateRepeatField
        templateId={templateId}
        recurrenceRule={weeklyRule}
        lastGeneratedDate={null}
        anchorDate={anchorDate}
      />,
    )

    await user.click(screen.getByText('Weekly · Sun, Wed'))
    await user.click(screen.getByText('M'))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(mutate).toHaveBeenCalledWith({
      id: templateId,
      input: {
        recurrenceRule: {
          type: 'weekly',
          interval: 1,
          daysOfWeek: [0, 1, 3],
        },
      },
    })
  })
})
