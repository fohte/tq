import { DndContext } from '@dnd-kit/core'
import { SortableContext } from '@dnd-kit/sortable'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'

import { QueueItemRow } from '#components/task/queue-item-row'
import { makeTask } from '#components/task/task-row-test-fixtures'
import { formatMinutes } from '#lib/format'
import { MemoizedStoryRouter } from '#storybook-config/story-router'

const task = makeTask({
  id: '00000000-0000-0000-0000-000000000001',
  title: 'Plan the launch',
  estimatedMinutes: 90,
})

function Providers({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return (
    <QueryClientProvider client={queryClient}>
      <MemoizedStoryRouter paths={['/tasks/$taskId']}>
        <DndContext>
          <SortableContext items={[task.id]}>{children}</SortableContext>
        </DndContext>
      </MemoizedStoryRouter>
    </QueryClientProvider>
  )
}

describe('QueueItemRow', () => {
  it('does not render estimate values or controls', () => {
    render(
      <Providers>
        <QueueItemRow
          task={task}
          queueKey="day"
          queueDate="2026-01-01"
          onRemove={() => {}}
        />
      </Providers>,
    )

    const getActual = () => ({
      estimateValue: screen.queryByText(formatMinutes(90)),
      estimateInput: screen.queryByRole('textbox'),
      noEstimateAction: screen.queryByText('No estimate'),
    })
    const expected = {
      estimateValue: null,
      estimateInput: null,
      noEstimateAction: null,
    }

    expect(getActual()).toEqual(expected)
  })
})
