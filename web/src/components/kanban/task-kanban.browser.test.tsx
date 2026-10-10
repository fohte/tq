import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { TaskKanban } from '#components/kanban/task-kanban'
import {
  makeQueueCandidate,
  makeTask,
} from '#components/task/task-row-test-fixtures'
import { MemoizedStoryRouter } from '#storybook-config/story-router'

const inboxTask = makeTask({ id: 'kanban-inbox-task', title: 'Inbox task' })
const activeTask = makeTask({ id: 'kanban-active-task', title: 'Active task' })
const waitingTask = makeTask({
  id: 'kanban-waiting-task',
  title: 'Waiting task',
})
const candidateTask = makeTask({
  id: 'kanban-candidate-task',
  title: 'Candidate task',
})

function Providers({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>
      <MemoizedStoryRouter paths={['/tasks/$taskId']}>
        {children}
      </MemoizedStoryRouter>
    </QueryClientProvider>
  )
}

async function waitForDndClickSuppressionToClear() {
  const probe = document.createElement('div')
  document.body.append(probe)

  let clickReachedWindow = false
  const markClickAsReachedWindow = () => {
    clickReachedWindow = true
  }
  window.addEventListener('click', markClickAsReachedWindow)

  const waiting = waitFor(() => {
    clickReachedWindow = false
    probe.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(clickReachedWindow).toBe(true)
  })

  await waiting.finally(() => {
    window.removeEventListener('click', markClickAsReachedWindow)
    probe.remove()
  })
}

async function dragByTitle(sourceTitle: string, target: HTMLElement) {
  const source = (await screen.findByText(sourceTitle)).closest(
    '[role="button"]',
  )
  if (!(source instanceof HTMLElement)) {
    throw new Error('Could not find drag source')
  }

  const sourceRect = source.getBoundingClientRect()
  const targetRect = target.getBoundingClientRect()
  const sourceX = sourceRect.x + sourceRect.width / 2
  const sourceY = sourceRect.y + sourceRect.height / 2
  const targetX = targetRect.x + targetRect.width / 2
  const targetY = targetRect.y + targetRect.height / 2

  fireEvent.mouseDown(source, { button: 0, clientX: sourceX, clientY: sourceY })
  fireEvent.mouseMove(document, {
    buttons: 1,
    clientX: sourceX + 10,
    clientY: sourceY + 10,
  })
  fireEvent.mouseMove(document, {
    buttons: 1,
    clientX: targetX,
    clientY: targetY,
  })
  fireEvent.mouseUp(document, { button: 0, clientX: targetX, clientY: targetY })
  await waitForDndClickSuppressionToClear()
}

describe('TaskKanban waiting column dragging', () => {
  it('rejects incoming tasks and candidates and keeps waiting tasks locked', async () => {
    const onDrop = vi.fn()
    const onInsertCandidate = vi.fn()
    const onAddCandidate = vi.fn()
    render(
      <Providers>
        <div style={{ height: 600, width: 800 }}>
          <TaskKanban
            columns={[
              { id: 'inbox', title: 'Inbox', tasks: [inboxTask] },
              { id: 'active', title: 'Active', tasks: [activeTask] },
              {
                id: 'waiting',
                title: 'Waiting',
                tasks: [waitingTask],
                acceptsDrops: false,
              },
            ]}
            onDrop={onDrop}
            candidates={[
              makeQueueCandidate({
                task: candidateTask,
                reason: { kind: 'active' },
              }),
            ]}
            onAddCandidate={onAddCandidate}
            onInsertCandidate={onInsertCandidate}
          />
        </div>
      </Providers>,
    )

    const waitingRegion = await screen.findByRole('region', {
      name: 'Waiting tasks',
    })
    await dragByTitle('Inbox task', waitingRegion)
    await dragByTitle('Candidate task', waitingRegion)
    await dragByTitle(
      'Waiting task',
      screen.getByRole('region', { name: 'Active tasks' }),
    )

    const readCalls = () => ({
      dropCalls: onDrop.mock.calls,
      candidateCalls: onInsertCandidate.mock.calls,
    })
    await waitFor(() => {
      expect(readCalls()).toEqual({ dropCalls: [], candidateCalls: [] })
    })
  })
})
