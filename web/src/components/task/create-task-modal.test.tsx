import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CreateTaskModal } from '@web/components/task/create-task-modal'
import { renderControlledModal } from '@web/lib/render-controlled-modal'
import { atIndex } from '@web/lib/test-utils'
import { describe, expect, it } from 'vitest'

describe('CreateTaskModal', () => {
  it('removes the modal from the DOM when the close (X) button is clicked', async () => {
    const user = userEvent.setup()
    renderControlledModal(CreateTaskModal, {})

    const closeButtons = screen.getAllByRole('button', { name: 'Close' })
    await user.click(atIndex(closeButtons, 0))

    await waitFor(() => {
      expect(
        screen.queryByPlaceholderText('Task title'),
      ).not.toBeInTheDocument()
    })
  })

  it('removes the modal from the DOM when the Cancel button is clicked', async () => {
    const user = userEvent.setup()
    renderControlledModal(CreateTaskModal, {})

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    await waitFor(() => {
      expect(
        screen.queryByPlaceholderText('Task title'),
      ).not.toBeInTheDocument()
    })
  })
})
