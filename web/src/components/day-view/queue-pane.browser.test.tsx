import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { QueuePane } from '#components/day-view/queue-pane'
import { makeQueueSectionData } from '#components/day-view/queue-pane-test-fixtures'
import { makeTask } from '#components/task/task-row-test-fixtures'
import { getQueueCandidates } from '#lib/queue-candidates'
import { MemoizedStoryRouter } from '#storybook-config/story-router'

const dayTask = makeTask({
  id: 'day-task',
  title: 'Day task',
  estimatedMinutes: 30,
})
const anotherDayTask = makeTask({
  id: 'another-day-task',
  title: 'Another day task',
  estimatedMinutes: 30,
})
const weekTask = makeTask({
  id: 'week-task',
  title: 'Week task',
  estimatedMinutes: 30,
})
const scheduledTask = makeTask({
  id: 'scheduled-task',
  title: 'Scheduled task',
  estimatedMinutes: 90,
})
const candidateTask = makeTask({
  id: 'candidate-task',
  title: 'Candidate task',
  estimatedMinutes: 30,
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

function renderQueuePane(
  onMoveTask = vi.fn(),
  onInsertCandidate = vi.fn(),
  onMoveScheduledTaskToWeek = vi.fn(),
) {
  render(
    <Providers>
      <div style={{ height: 600, width: 480 }}>
        <QueuePane
          isLoading={false}
          queueDate="2026-01-01"
          queueSections={[
            makeQueueSectionData({
              key: 'day',
              title: 'today',
              items: [dayTask, anotherDayTask],
              emptyMessage: "No tasks in today's queue",
            }),
            makeQueueSectionData({
              key: 'week',
              title: 'this week',
              items: [weekTask],
              dayGroups: [
                {
                  date: '2026-01-03',
                  label: 'Sat 01-03',
                  items: [scheduledTask],
                },
              ],
              emptyMessage: "No tasks in this week's queue",
            }),
          ]}
          queueCandidates={getQueueCandidates([candidateTask], new Set())}
          onMoveTask={onMoveTask}
          onInsertCandidate={onInsertCandidate}
          onRemoveFromQueue={vi.fn()}
          onMoveScheduledTaskToWeek={onMoveScheduledTaskToWeek}
        />
      </div>
    </Providers>,
  )
  return { onMoveTask, onInsertCandidate, onMoveScheduledTaskToWeek }
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

async function dragByTitle(sourceTitle: string, targetTitle: string) {
  const source = (await screen.findByText(sourceTitle)).closest('.cursor-grab')
  const target = (await screen.findByText(targetTitle)).closest('.cursor-grab')
  if (!(source instanceof HTMLElement) || !(target instanceof HTMLElement)) {
    throw new Error('Could not find drag source and queue target')
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

describe('QueuePane dragging', () => {
  it('does not reorder tasks dragged within the same queue', async () => {
    const { onMoveTask } = renderQueuePane()

    await dragByTitle('Day task', 'Another day task')

    await waitFor(() => {
      expect(onMoveTask.mock.calls).toEqual([])
    })
  })

  it('moves a task when it is dragged to another queue', async () => {
    const { onMoveTask } = renderQueuePane()

    await dragByTitle('Day task', 'Week task')

    await waitFor(() => {
      expect(onMoveTask.mock.calls).toEqual([['day-task', 'day', 'week']])
    })
  })

  it('adds a candidate when it is dragged into a queue', async () => {
    const { onInsertCandidate } = renderQueuePane()

    await dragByTitle(candidateTask.title, 'Week task')

    await waitFor(() => {
      expect(onInsertCandidate.mock.calls).toEqual([['week', 'candidate-task']])
    })
  })

  it('passes the scheduled date when a task is returned to the week queue', async () => {
    const onMoveScheduledTaskToWeek = vi.fn()
    const user = userEvent.setup()
    renderQueuePane(vi.fn(), vi.fn(), onMoveScheduledTaskToWeek)

    const removeButton = await screen.findByRole('button', {
      name: 'Remove day from Scheduled task',
    })
    const row = removeButton.closest('[data-queue-key]')
    await user.click(removeButton)

    const readResult = () => ({
      callbackCalls: onMoveScheduledTaskToWeek.mock.calls,
      queueSource: {
        key: row?.getAttribute('data-queue-key'),
        date: row?.getAttribute('data-queue-date'),
        taskId: row
          ?.querySelector('[data-task-id]')
          ?.getAttribute('data-task-id'),
      },
      rowText: row?.textContent,
      weekCount: screen.getByText('1 + 1').textContent,
    })

    expect(readResult()).toEqual({
      callbackCalls: [[scheduledTask.id, '2026-01-03']],
      queueSource: {
        key: 'day',
        date: '2026-01-03',
        taskId: scheduledTask.id,
      },
      rowText: 'Scheduled task',
      weekCount: '1 + 1',
    })
  })
})
