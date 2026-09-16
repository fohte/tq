import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ProjectListToolbar } from '#components/project/project-list-toolbar'

describe('ProjectListToolbar', () => {
  it('marks the current filter tab as pressed', () => {
    render(
      <ProjectListToolbar
        filter="active"
        onFilterChange={vi.fn()}
        onCreate={vi.fn()}
      />,
    )

    expect(screen.getByText('active')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('all')).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onFilterChange when a different tab is clicked', async () => {
    const onFilterChange = vi.fn()
    const user = userEvent.setup()
    render(
      <ProjectListToolbar
        filter="active"
        onFilterChange={onFilterChange}
        onCreate={vi.fn()}
      />,
    )

    await user.click(screen.getByText('all'))

    expect(onFilterChange).toHaveBeenCalledWith('all')
  })

  it('calls onCreate when the +new button is clicked', async () => {
    const onCreate = vi.fn()
    const user = userEvent.setup()
    render(
      <ProjectListToolbar
        filter="active"
        onFilterChange={vi.fn()}
        onCreate={onCreate}
      />,
    )

    await user.click(screen.getByText('+ new'))

    expect(onCreate).toHaveBeenCalledOnce()
  })
})
