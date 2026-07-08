import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProjectFormModal } from '@web/components/project/project-form-modal'
import { atIndex } from '@web/lib/test-utils'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

function renderModal(
  props: {
    open?: boolean
    onOpenChange?: () => void
    project?: React.ComponentProps<typeof ProjectFormModal>['project']
  } = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const onOpenChange = props.onOpenChange ?? vi.fn()

  return render(
    <QueryClientProvider client={queryClient}>
      <ProjectFormModal
        open={props.open ?? true}
        onOpenChange={onOpenChange}
        {...(props.project != null ? { project: props.project } : {})}
      />
    </QueryClientProvider>,
  )
}

function ControlledProjectFormModal({
  project,
}: {
  project?: React.ComponentProps<typeof ProjectFormModal>['project']
}) {
  const [open, setOpen] = useState(true)
  return (
    <ProjectFormModal
      open={open}
      onOpenChange={setOpen}
      {...(project != null ? { project } : {})}
    />
  )
}

function renderControlledModal(
  props: {
    project?: React.ComponentProps<typeof ProjectFormModal>['project']
  } = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <ControlledProjectFormModal {...props} />
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
    renderControlledModal()

    const closeButton = document.body
      .getElementsByClassName('lucide-x')[0]
      ?.closest('button')
    if (!(closeButton instanceof HTMLButtonElement)) {
      throw new Error('close button not found')
    }
    await user.click(closeButton)

    await waitFor(() => {
      expect(screen.queryAllByPlaceholderText('Project name')).toHaveLength(0)
    })
  })

  it('removes the modal from the DOM when the Cancel button is clicked', async () => {
    const user = userEvent.setup()
    renderControlledModal()

    await user.click(atIndex(screen.getAllByText('Cancel'), 0))

    await waitFor(() => {
      expect(screen.queryAllByPlaceholderText('Project name')).toHaveLength(0)
    })
  })
})
