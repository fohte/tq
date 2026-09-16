import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { TaskSortFilterFields } from '#components/task/task-sort-filter-fields'

describe('TaskSortFilterFields', () => {
  it('changes the sort option', async () => {
    const onSortByChange = vi.fn()
    const user = userEvent.setup()
    render(
      <TaskSortFilterFields sortBy="updated" onSortByChange={onSortByChange} />,
    )

    await user.click(screen.getByRole('button', { name: 'Created' }))

    expect(onSortByChange).toHaveBeenCalledWith('created')
  })
})
