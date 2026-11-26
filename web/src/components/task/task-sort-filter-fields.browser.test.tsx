import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { TaskSortFilterFields } from '#components/task/task-sort-filter-fields'
import type { TaskSortBy } from '#hooks/use-tasks'

async function press(sortBy: TaskSortBy[], buttonName: string) {
  const onSortByChange = vi.fn()
  const user = userEvent.setup()
  render(
    <TaskSortFilterFields sortBy={sortBy} onSortByChange={onSortByChange} />,
  )

  await user.click(screen.getByRole('button', { name: buttonName }))

  return onSortByChange.mock.calls
}

describe('TaskSortFilterFields', () => {
  it('appends an unpressed key after the pressed keys', async () => {
    expect(await press(['priority', 'updated'], 'Due')).toEqual([
      [['priority', 'updated', 'due']],
    ])
  })

  it('removes a pressed key so later keys move up', async () => {
    expect(await press(['priority', 'updated', 'due'], 'Priority 1')).toEqual([
      [['updated', 'due']],
    ])
  })

  it('keeps the last pressed key', async () => {
    expect(await press(['updated'], 'Updated')).toEqual([[['updated']]])
  })
})
