import { describe, expect, it } from 'vitest'

import { ApiError, BoundaryError } from '#errors'

class TaskStorePersistenceError extends BoundaryError {}

describe('BoundaryError', () => {
  it('derives name from the subclass and preserves the original error as cause', () => {
    const original = new Error('connection refused')

    const wrapped = new TaskStorePersistenceError('failed to save', original)

    expect(wrapped).toEqual(
      new TaskStorePersistenceError('failed to save', original),
    )
  })
})

describe('ApiError', () => {
  it('holds the HTTP status and message', () => {
    const error = new ApiError(404, 'Task not found')

    expect(error).toEqual(new ApiError(404, 'Task not found'))
  })
})
