import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { TimeBlockCard } from '#components/task/time-block-card'
import { makeTimeBlock } from '#components/task/time-block-test-fixtures'

describe('TimeBlockCard', () => {
  it('confirms deleting a manual time block', async () => {
    const onDelete = vi.fn()
    const user = userEvent.setup()
    render(<TimeBlockCard block={makeTimeBlock()} onDelete={onDelete} />)

    await user.click(screen.getByRole('button', { name: 'Delete time block' }))

    expect(await screen.findByText('Delete time block')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Are you sure you want to delete this time block? This action cannot be undone.',
      ),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(onDelete).toHaveBeenCalled()
  })

  it('confirms removing an auto-scheduled time block from the queue', async () => {
    const onDelete = vi.fn()
    const user = userEvent.setup()
    render(
      <TimeBlockCard
        block={makeTimeBlock({ isAutoScheduled: true })}
        onDelete={onDelete}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Remove from queue' }))

    expect(await screen.findByText('Remove from queue')).toBeInTheDocument()
    expect(
      screen.getByText(
        "This task will be removed from that day's queue and won't be auto-scheduled again unless you re-add it.",
      ),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(onDelete).toHaveBeenCalled()
  })
})
