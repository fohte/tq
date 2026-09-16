import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { makeTask } from '#components/task/task-row-test-fixtures'
import { TimeBlockPreviewCard } from '#components/task/time-block-preview-card'
import { makeTimeBlock } from '#components/task/time-block-test-fixtures'

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    Link: ({
      children,
      to,
      params,
      ...props
    }: {
      children: React.ReactNode
      to?: string
      params?: Record<string, unknown>
    } & Record<string, unknown>) => (
      <a
        href={typeof to === 'string' ? to : '#'}
        data-params={params != null ? JSON.stringify(params) : undefined}
        {...props}
      >
        {children}
      </a>
    ),
  }
})

const task = makeTask({ number: 12, title: 'Write onboarding doc' })

describe('TimeBlockPreviewCard', () => {
  it('calls onDelete once the confirmation dialog is confirmed', async () => {
    const onDelete = vi.fn()
    const user = userEvent.setup()
    render(
      <TimeBlockPreviewCard
        task={task}
        block={makeTimeBlock()}
        onDelete={onDelete}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Delete time block' }))
    await user.click(await screen.findByRole('button', { name: 'Delete' }))

    expect(onDelete).toHaveBeenCalled()
  })
})
