import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { EditLabelDialog } from '#components/label/edit-label-dialog'
import { makeLabel } from '#components/label/label-test-fixtures'
import { useUpdateLabel } from '#hooks/use-labels'
import { clickSelectOption } from '#lib/test-utils'

vi.mock('#hooks/use-labels', async (importOriginal) => {
  const original = await importOriginal<typeof import('#hooks/use-labels')>()
  return {
    ...original,
    useUpdateLabel: vi.fn(),
  }
})

const mockUseUpdateLabel = vi.mocked(useUpdateLabel)

type UpdateLabelResult = ReturnType<typeof useUpdateLabel>

function partialMutation(
  partial: Partial<UpdateLabelResult>,
): UpdateLabelResult {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- partial mock of hook return value
  return partial as UpdateLabelResult
}

const label = makeLabel({ name: 'oncall', context: 'work' })

describe('EditLabelDialog', () => {
  it('disables Save when the name is cleared', async () => {
    mockUseUpdateLabel.mockReturnValue(
      partialMutation({ mutate: vi.fn(), isPending: false, isError: false }),
    )
    const user = userEvent.setup()
    render(<EditLabelDialog label={label} open onOpenChange={vi.fn()} />)

    await user.clear(screen.getByDisplayValue('oncall'))

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('closes the dialog once the rename succeeds', async () => {
    const mutate = vi.fn(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test double: EditLabelDialog's onSuccess callback ignores every argument, so the exact mutate signature doesn't matter here
      ((_vars: unknown, options?: { onSuccess?: () => void }) => {
        options?.onSuccess?.()
      }) as UpdateLabelResult['mutate'],
    )
    mockUseUpdateLabel.mockReturnValue(
      partialMutation({ mutate, isPending: false, isError: false }),
    )
    const onOpenChange = vi.fn()
    const user = userEvent.setup()
    render(<EditLabelDialog label={label} open onOpenChange={onOpenChange} />)

    const input = screen.getByDisplayValue('oncall')
    await user.clear(input)
    await user.type(input, 'urgent')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('submits the updated name and context', async () => {
    const mutate = vi.fn<UpdateLabelResult['mutate']>()
    mockUseUpdateLabel.mockReturnValue(
      partialMutation({ mutate, isPending: false, isError: false }),
    )
    const user = userEvent.setup()
    render(<EditLabelDialog label={label} open onOpenChange={vi.fn()} />)

    await user.click(screen.getByRole('combobox'))
    await clickSelectOption(
      user,
      await screen.findByRole('option', { name: 'Personal' }),
    )
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(mutate).toHaveBeenCalledWith(
      { id: label.id, input: { name: 'oncall', context: 'personal' } },
      expect.anything(),
    )
  })

  it('shows the error message when the mutation fails', () => {
    mockUseUpdateLabel.mockReturnValue(
      partialMutation({
        mutate: vi.fn(),
        isPending: false,
        isError: true,
        error: new Error('A label with this name already exists'),
      }),
    )
    render(<EditLabelDialog label={label} open onOpenChange={vi.fn()} />)

    expect(
      screen.getByText('A label with this name already exists'),
    ).toBeInTheDocument()
  })
})
