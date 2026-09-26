import { Button } from '@fohte/ui/button'
import { DialogTrigger } from '@fohte/ui/dialog'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { DeleteConfirmDialog } from '#components/ui/delete-confirm-dialog'

describe('DeleteConfirmDialog', () => {
  it('opens from the trigger and calls onConfirm when confirmed', async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    render(
      <DeleteConfirmDialog
        title="Delete item"
        description="Are you sure you want to delete this item? This action cannot be undone."
        onConfirm={onConfirm}
      >
        <DialogTrigger render={<Button variant="outline" />}>
          Delete item
        </DialogTrigger>
      </DeleteConfirmDialog>,
    )

    await user.click(screen.getByRole('button', { name: 'Delete item' }))
    await user.click(await screen.findByRole('button', { name: 'Delete' }))

    expect(onConfirm).toHaveBeenCalled()
  })
})
