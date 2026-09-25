import { describe, expect, it } from 'vitest'

import { replaceVisibleQueueTaskIds } from '#lib/queue-task-order'

describe('replaceVisibleQueueTaskIds', () => {
  it('keeps hidden tasks in their stored slots when visible tasks are reordered', () => {
    expect(
      replaceVisibleQueueTaskIds(
        [
          'task-hidden-a',
          'task-visible-a',
          'task-hidden-b',
          'task-visible-b',
          'task-hidden-c',
        ],
        ['task-visible-a', 'task-visible-b'],
        ['task-visible-b', 'task-visible-a'],
      ),
    ).toEqual([
      'task-hidden-a',
      'task-visible-b',
      'task-hidden-b',
      'task-visible-a',
      'task-hidden-c',
    ])
  })

  it('removes a visible task without moving hidden tasks', () => {
    expect(
      replaceVisibleQueueTaskIds(
        ['task-hidden-a', 'task-visible-a', 'task-hidden-b', 'task-visible-b'],
        ['task-visible-a', 'task-visible-b'],
        ['task-visible-b'],
      ),
    ).toEqual(['task-hidden-a', 'task-visible-b', 'task-hidden-b'])
  })

  it('inserts a new visible task before the next visible anchor', () => {
    expect(
      replaceVisibleQueueTaskIds(
        ['task-hidden-a', 'task-visible-a', 'task-hidden-b', 'task-visible-b'],
        ['task-visible-a', 'task-visible-b'],
        ['task-new', 'task-visible-b', 'task-visible-a'],
      ),
    ).toEqual([
      'task-hidden-a',
      'task-new',
      'task-visible-b',
      'task-hidden-b',
      'task-visible-a',
    ])
  })

  it('appends a new visible task when it has no later visible anchor', () => {
    expect(
      replaceVisibleQueueTaskIds(
        ['task-hidden-a', 'task-visible-a', 'task-hidden-b'],
        ['task-visible-a'],
        ['task-visible-a', 'task-new'],
      ),
    ).toEqual(['task-hidden-a', 'task-visible-a', 'task-hidden-b', 'task-new'])
  })
})
