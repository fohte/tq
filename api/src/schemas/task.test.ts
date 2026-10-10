import { describe, expect, it } from 'vitest'

import { listTasksQuerySchema } from '#schemas/task'

describe('listTasksQuerySchema status', () => {
  it('keeps all statuses when parsed twice', () => {
    const statusSchema = listTasksQuerySchema.shape.status

    expect(statusSchema.parse(statusSchema.parse('all'))).toEqual(['all'])
  })

  it('treats all as unfiltered when combined with a status', () => {
    expect(listTasksQuerySchema.shape.status.parse(['all', 'todo'])).toEqual([
      'all',
    ])
  })
})
