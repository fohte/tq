import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { DeleteRecurringTemplateDialog } from '#components/recurring/delete-recurring-template-dialog'
import { useDeleteRecurringTemplate } from '#hooks/use-recurring-templates'
import {
  mutateInvokingOnSuccess,
  partialMutation,
  withOnSuccess,
} from '#lib/test-utils'

vi.mock('#hooks/use-recurring-templates', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('#hooks/use-recurring-templates')>()
  return {
    ...original,
    useDeleteRecurringTemplate: vi.fn(),
  }
})

const mockUseDeleteRecurringTemplate = vi.mocked(useDeleteRecurringTemplate)

type DeleteRecurringTemplateResult = ReturnType<
  typeof useDeleteRecurringTemplate
>

describe('DeleteRecurringTemplateDialog', () => {
  it('calls mutate with the template id', async () => {
    const mutate = vi.fn<DeleteRecurringTemplateResult['mutate']>()
    mockUseDeleteRecurringTemplate.mockReturnValue(
      partialMutation<DeleteRecurringTemplateResult>({ mutate }),
    )
    const user = userEvent.setup()
    render(
      <DeleteRecurringTemplateDialog
        open
        onOpenChange={vi.fn()}
        templateId="00000000-0000-0000-0000-000000000001"
        templateTitle="Write weekly report"
        onDeleted={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(mutate).toHaveBeenCalledWith(
      '00000000-0000-0000-0000-000000000001',
      withOnSuccess,
    )
  })

  it('calls onDeleted when the deletion succeeds', async () => {
    const mutate =
      mutateInvokingOnSuccess<DeleteRecurringTemplateResult['mutate']>()
    mockUseDeleteRecurringTemplate.mockReturnValue(
      partialMutation<DeleteRecurringTemplateResult>({ mutate }),
    )
    const onDeleted = vi.fn()
    const user = userEvent.setup()
    render(
      <DeleteRecurringTemplateDialog
        open
        onOpenChange={vi.fn()}
        templateId="00000000-0000-0000-0000-000000000001"
        templateTitle="Write weekly report"
        onDeleted={onDeleted}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(onDeleted).toHaveBeenCalled()
  })
})
