import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { SaveViewButton } from '#components/saved-view/save-view-button'
import { useCreateSavedView } from '#hooks/use-saved-views'
import {
  mutateInvokingOnSuccess,
  partialMutation,
  withOnSuccess,
} from '#lib/test-utils'

vi.mock('#hooks/use-saved-views', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('#hooks/use-saved-views')>()
  return {
    ...original,
    useCreateSavedView: vi.fn(),
  }
})

const mockUseCreateSavedView = vi.mocked(useCreateSavedView)

type CreateSavedViewResult = ReturnType<typeof useCreateSavedView>

const query = 'is:todo sort:updated'

describe('SaveViewButton', () => {
  it('opens the dialog when clicked', async () => {
    mockUseCreateSavedView.mockReturnValue(
      partialMutation<CreateSavedViewResult>({
        mutate: vi.fn(),
        isPending: false,
        isError: false,
      }),
    )
    const user = userEvent.setup()
    render(<SaveViewButton query={query} />)

    await user.click(screen.getByRole('button', { name: 'Save view' }))

    // The dialog's open animation starts at opacity 0, so the input exists
    // in the DOM before it's visible — wait for the animation to settle.
    const input = await screen.findByPlaceholderText('View name')
    await waitFor(() => {
      expect(input).toBeVisible()
    })
  })

  it('disables Save when the name is empty', () => {
    mockUseCreateSavedView.mockReturnValue(
      partialMutation<CreateSavedViewResult>({
        mutate: vi.fn(),
        isPending: false,
        isError: false,
      }),
    )
    render(<SaveViewButton query={query} initialOpen />)

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('closes the dialog once the save succeeds', async () => {
    const mutate = mutateInvokingOnSuccess<CreateSavedViewResult['mutate']>()
    mockUseCreateSavedView.mockReturnValue(
      partialMutation<CreateSavedViewResult>({
        mutate,
        isPending: false,
        isError: false,
      }),
    )
    const user = userEvent.setup()
    render(<SaveViewButton query={query} initialOpen />)

    await user.type(screen.getByPlaceholderText('View name'), 'Now')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('View name')).not.toBeInTheDocument()
    })
  })

  it('submits the trimmed name and query', async () => {
    const mutate = vi.fn<CreateSavedViewResult['mutate']>()
    mockUseCreateSavedView.mockReturnValue(
      partialMutation<CreateSavedViewResult>({
        mutate,
        isPending: false,
        isError: false,
      }),
    )
    const user = userEvent.setup()
    render(<SaveViewButton query={query} initialOpen />)

    await user.type(screen.getByPlaceholderText('View name'), '  Now  ')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(mutate).toHaveBeenCalledWith({ name: 'Now', query }, withOnSuccess)
  })

  it('shows the error message when the mutation fails', () => {
    mockUseCreateSavedView.mockReturnValue(
      partialMutation<CreateSavedViewResult>({
        mutate: vi.fn(),
        isPending: false,
        isError: true,
        error: new Error('A view with this name already exists'),
      }),
    )
    render(<SaveViewButton query={query} initialOpen />)

    expect(
      screen.getByText('A view with this name already exists'),
    ).toBeInTheDocument()
  })
})
