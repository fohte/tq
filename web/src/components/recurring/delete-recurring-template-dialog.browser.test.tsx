import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { DeleteRecurringTemplateDialog } from '#components/recurring/delete-recurring-template-dialog'
import { useDeleteRecurringTemplate } from '#hooks/use-recurring-templates'
import { partialMutation } from '#lib/test-utils'

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
  it('deletes the template and calls onDeleted on success', async () => {
    const mutate = vi.fn(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test double: DeleteRecurringTemplateDialog's onSuccess callback ignores every argument, so the exact mutate signature doesn't matter here
      ((_id: unknown, options?: { onSuccess?: () => void }) => {
        options?.onSuccess?.()
      }) as DeleteRecurringTemplateResult['mutate'],
    )
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

    expect(mutate).toHaveBeenCalledWith(
      '00000000-0000-0000-0000-000000000001',
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- vitest's expect.any() return type isn't generic, so TS can only type this property as `any`
      { onSuccess: expect.any(Function) },
    )
    expect(onDeleted).toHaveBeenCalled()
  })
})
