import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { makeSavedView } from '#components/layout/sidebar-test-fixtures'
import { RenameSavedViewDialog } from '#components/saved-view/rename-saved-view-dialog'
import { useRenameSavedView } from '#hooks/use-saved-views'
import { partialMutation } from '#lib/test-utils'

vi.mock('#hooks/use-saved-views', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('#hooks/use-saved-views')>()
  return {
    ...original,
    useRenameSavedView: vi.fn(),
  }
})

const mockUseRenameSavedView = vi.mocked(useRenameSavedView)

type RenameSavedViewResult = ReturnType<typeof useRenameSavedView>

const view = makeSavedView({ name: 'Now' })

describe('RenameSavedViewDialog', () => {
  it('disables Save when the name is cleared', async () => {
    mockUseRenameSavedView.mockReturnValue(
      partialMutation<RenameSavedViewResult>({
        mutate: vi.fn(),
        isPending: false,
        isError: false,
      }),
    )
    const user = userEvent.setup()
    render(<RenameSavedViewDialog view={view} open onOpenChange={vi.fn()} />)

    await user.clear(screen.getByDisplayValue('Now'))

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('closes the dialog once the rename succeeds', async () => {
    const mutate = vi.fn(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test double: RenameSavedViewDialog's onSuccess callback ignores every argument, so the exact mutate signature doesn't matter here
      ((_vars: unknown, options?: { onSuccess?: () => void }) => {
        options?.onSuccess?.()
      }) as RenameSavedViewResult['mutate'],
    )
    mockUseRenameSavedView.mockReturnValue(
      partialMutation<RenameSavedViewResult>({
        mutate,
        isPending: false,
        isError: false,
      }),
    )
    const onOpenChange = vi.fn()
    const user = userEvent.setup()
    render(
      <RenameSavedViewDialog view={view} open onOpenChange={onOpenChange} />,
    )

    const input = screen.getByDisplayValue('Now')
    await user.clear(input)
    await user.type(input, 'Later')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('submits the trimmed name', async () => {
    const mutate = vi.fn<RenameSavedViewResult['mutate']>()
    mockUseRenameSavedView.mockReturnValue(
      partialMutation<RenameSavedViewResult>({
        mutate,
        isPending: false,
        isError: false,
      }),
    )
    const user = userEvent.setup()
    render(<RenameSavedViewDialog view={view} open onOpenChange={vi.fn()} />)

    const input = screen.getByDisplayValue('Now')
    await user.clear(input)
    await user.type(input, '  Later  ')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(mutate).toHaveBeenCalledWith(
      { id: view.id, name: 'Later' },
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- vitest's expect.any() return type isn't generic, so TS can only type this property as `any`
      { onSuccess: expect.any(Function) },
    )
  })

  it('shows the error message when the mutation fails', () => {
    mockUseRenameSavedView.mockReturnValue(
      partialMutation<RenameSavedViewResult>({
        mutate: vi.fn(),
        isPending: false,
        isError: true,
        error: new Error('A view with this name already exists'),
      }),
    )
    render(<RenameSavedViewDialog view={view} open onOpenChange={vi.fn()} />)

    expect(
      screen.getByText('A view with this name already exists'),
    ).toBeInTheDocument()
  })
})
