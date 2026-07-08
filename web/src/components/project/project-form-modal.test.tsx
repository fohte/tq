import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProjectFormModal } from '@web/components/project/project-form-modal'
import { atIndex } from '@web/lib/test-utils'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

// Manages `open` as real state (instead of a no-op onOpenChange mock) so tests
// can verify the modal actually leaves the DOM after a close action.
function ManagedProjectFormModal({
  initialOpen,
  onOpenChange,
  project,
}: {
  initialOpen: boolean
  onOpenChange?: (open: boolean) => void
  project?: React.ComponentProps<typeof ProjectFormModal>['project']
}) {
  const [open, setOpen] = useState(initialOpen)
  return (
    <ProjectFormModal
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        onOpenChange?.(nextOpen)
      }}
      {...(project != null ? { project } : {})}
    />
  )
}

function renderModal(
  props: {
    open?: boolean
    onOpenChange?: (open: boolean) => void
    project?: React.ComponentProps<typeof ProjectFormModal>['project']
  } = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <ManagedProjectFormModal
        initialOpen={props.open ?? true}
        {...(props.onOpenChange != null
          ? { onOpenChange: props.onOpenChange }
          : {})}
        {...(props.project != null ? { project: props.project } : {})}
      />
    </QueryClientProvider>,
  )
}

describe('ProjectFormModal', () => {
  it('renders create mode title when no project is provided', () => {
    renderModal()
    expect(screen.getAllByText('New Project').length).toBeGreaterThan(0)
  })

  it('renders edit mode title when project is provided', () => {
    renderModal({
      project: {
        id: '1',
        title: 'Test Project',
        description: 'desc',
        status: 'active',
        startDate: null,
        targetDate: null,
        color: '#FF8400',
        sortOrder: 0,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    })
    expect(screen.getAllByText('Edit Project').length).toBeGreaterThan(0)
  })

  it('disables create button when title is empty', () => {
    renderModal()
    const createButtons = screen.getAllByRole('button', {
      name: /create project/i,
    })
    for (const btn of createButtons) {
      expect(btn).toBeDisabled()
    }
  })

  it('enables create button after entering a title', async () => {
    const user = userEvent.setup()
    renderModal()

    const titleInputs = screen.getAllByPlaceholderText('Project name')
    await user.type(atIndex(titleInputs, 0), 'My Project')

    const createButtons = screen.getAllByRole('button', {
      name: /create project/i,
    })
    const enabledButton = createButtons.find(
      (btn) => !btn.hasAttribute('disabled'),
    )
    expect(enabledButton).toBeDefined()
  })

  it('pre-fills form fields in edit mode', () => {
    renderModal({
      project: {
        id: '1',
        title: 'Existing Project',
        description: 'Some description',
        status: 'paused',
        startDate: '2024-06-01',
        targetDate: '2024-12-31',
        color: '#4CAF50',
        sortOrder: 0,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    })

    const titleInputs =
      screen.getAllByDisplayValue<HTMLInputElement>('Existing Project')
    expect(titleInputs.length).toBeGreaterThan(0)

    const descInputs =
      screen.getAllByDisplayValue<HTMLTextAreaElement>('Some description')
    expect(descInputs.length).toBeGreaterThan(0)
  })

  it('renders color presets', () => {
    renderModal()
    const colorButtons = screen.getAllByTitle('Orange')
    expect(colorButtons.length).toBeGreaterThan(0)
  })

  it('removes the modal from the DOM when the close (X) button is clicked', async () => {
    const user = userEvent.setup()
    renderModal()

    await user.click(screen.getByRole('button', { name: 'Close' }))

    await waitFor(() => {
      expect(
        screen.queryByPlaceholderText('Project name'),
      ).not.toBeInTheDocument()
    })
  })

  it('removes the modal from the DOM when the Cancel button is clicked', async () => {
    const user = userEvent.setup()
    renderModal()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    await waitFor(() => {
      expect(
        screen.queryByPlaceholderText('Project name'),
      ).not.toBeInTheDocument()
    })
  })
})
