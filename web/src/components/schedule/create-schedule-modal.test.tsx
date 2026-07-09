import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CreateScheduleModal } from '@web/components/schedule/create-schedule-modal'
import { renderControlledModal } from '@web/lib/render-controlled-modal'
import { atIndex } from '@web/lib/test-utils'
import { describe, expect, it } from 'vitest'

describe('CreateScheduleModal', () => {
  it('removes the modal from the DOM when the close (X) button is clicked', async () => {
    const user = userEvent.setup()
    renderControlledModal(CreateScheduleModal, {})

    const closeButtons = screen.getAllByRole('button', { name: 'Close' })
    await user.click(atIndex(closeButtons, 0))

    await waitFor(() => {
      expect(
        screen.queryByPlaceholderText('Schedule title'),
      ).not.toBeInTheDocument()
    })
  })

  it('removes the modal from the DOM when the Cancel button is clicked', async () => {
    const user = userEvent.setup()
    renderControlledModal(CreateScheduleModal, {})

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    await waitFor(() => {
      expect(
        screen.queryByPlaceholderText('Schedule title'),
      ).not.toBeInTheDocument()
    })
  })
})
