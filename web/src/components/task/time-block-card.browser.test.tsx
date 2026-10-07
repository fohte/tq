import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { TimeBlockCard } from '#components/task/time-block-card'
import { makeTimeBlock } from '#components/task/time-block-test-fixtures'

function getConfirmationCopy(title: string | null, description: string | null) {
  return { title, description }
}

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
    it('shows the time-block deletion confirmation', async () => {
      const user = userEvent.setup()
      render(
        <TimeBlockCard
          block={makeTimeBlock({ isAutoScheduled: true })}
          onDelete={vi.fn()}
        />,
      )

      await user.click(
        screen.getByRole('button', { name: 'Delete time block' }),
      )

      expect(
        getConfirmationCopy(
          (await screen.findByText('Delete time block')).textContent,
          screen.getByText(
            'Are you sure you want to delete this time block? This action cannot be undone.',
          ).textContent,
        ),
      ).toEqual({
        title: 'Delete time block',
        description:
          'Are you sure you want to delete this time block? This action cannot be undone.',
      })
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
        screen.getByRole('button', { name: 'Delete time block' }),
      )
      await user.click(await screen.findByRole('button', { name: 'Delete' }))

      expect(onDelete).toHaveBeenCalled()
    })
  })
})
