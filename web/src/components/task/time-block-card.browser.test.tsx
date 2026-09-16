import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { TimeBlockCard } from '#components/task/time-block-card'
import { makeTimeBlock } from '#components/task/time-block-test-fixtures'

describe('TimeBlockCard', () => {
  describe('manual time block', () => {
    it('shows a confirmation dialog with the delete copy', async () => {
      const user = userEvent.setup()
      render(<TimeBlockCard block={makeTimeBlock()} onDelete={vi.fn()} />)

      await user.click(
        screen.getByRole('button', { name: 'Delete time block' }),
      )

      expect(await screen.findByText('Delete time block')).toBeInTheDocument()
      expect(
        screen.getByText(
          'Are you sure you want to delete this time block? This action cannot be undone.',
        ),
      ).toBeInTheDocument()
    })

    it('calls onDelete when the deletion is confirmed', async () => {
      const onDelete = vi.fn()
      const user = userEvent.setup()
      render(<TimeBlockCard block={makeTimeBlock()} onDelete={onDelete} />)

      await user.click(
        screen.getByRole('button', { name: 'Delete time block' }),
      )
      await user.click(await screen.findByRole('button', { name: 'Delete' }))

      expect(onDelete).toHaveBeenCalled()
    })
  })

  describe('auto-scheduled time block', () => {
    it('shows a confirmation dialog with the remove-from-queue copy', async () => {
      const user = userEvent.setup()
      render(
        <TimeBlockCard
          block={makeTimeBlock({ isAutoScheduled: true })}
          onDelete={vi.fn()}
        />,
      )

      await user.click(
        screen.getByRole('button', { name: 'Remove from queue' }),
      )

      expect(await screen.findByText('Remove from queue')).toBeInTheDocument()
      expect(
        screen.getByText(
          "This task will be removed from that day's queue and won't be auto-scheduled again unless you re-add it.",
        ),
      ).toBeInTheDocument()
    })

    it('calls onDelete when the removal is confirmed', async () => {
      const onDelete = vi.fn()
      const user = userEvent.setup()
      render(
        <TimeBlockCard
          block={makeTimeBlock({ isAutoScheduled: true })}
          onDelete={onDelete}
        />,
      )

      await user.click(
        screen.getByRole('button', { name: 'Remove from queue' }),
      )
      await user.click(await screen.findByRole('button', { name: 'Delete' }))

      expect(onDelete).toHaveBeenCalled()
    })
  })
})
