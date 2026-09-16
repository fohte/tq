import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ProjectListEmptyState } from '#components/project/project-list-empty-state'

describe('ProjectListEmptyState', () => {
  it('calls onCreate when the button is clicked', async () => {
    const onCreate = vi.fn()
    const user = userEvent.setup()
    render(<ProjectListEmptyState onCreate={onCreate} />)

    await user.click(
      screen.getByRole('button', { name: 'Create your first project' }),
    )

    expect(onCreate).toHaveBeenCalledOnce()
  })
})
