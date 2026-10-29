import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { RecurringTemplateListToolbar } from '#components/recurring/recurring-template-list-toolbar'

describe('RecurringTemplateListToolbar', () => {
  it('calls onCreate when the + new button is clicked', async () => {
    const onCreate = vi.fn()
    const user = userEvent.setup()
    render(<RecurringTemplateListToolbar onCreate={onCreate} />)

    await user.click(screen.getByRole('button', { name: '+ new' }))

    expect(onCreate.mock.calls).toEqual([[]])
  })
})
