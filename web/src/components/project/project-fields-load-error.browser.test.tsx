import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ProjectFieldsLoadError } from '#components/project/project-fields-load-error'

describe('ProjectFieldsLoadError', () => {
  it('retries loading project fields from the mobile sidebar', async () => {
    const onRetry = vi.fn()
    const user = userEvent.setup()
    render(<ProjectFieldsLoadError mobile onRetry={onRetry} />)

    await user.click(screen.getByRole('button', { name: 'Retry' }))

    const readResult = () => ({
      alert: screen.getByRole('alert').textContent,
      retries: onRetry.mock.calls,
    })
    expect(readResult()).toEqual({
      alert: 'Could not load project fields.Retry',
      retries: [[]],
    })
  })
})
