import { describe, expect, it } from 'vitest'

import { ApiError, BoundaryError } from '#errors'

class TaskStorePersistenceError extends BoundaryError {}

function normalizeBoundaryError(error: Error) {
  return {
    name: error.name,
    message: error.message,
    cause: error.cause,
  }
}

function normalizeApiError(error: ApiError) {
  return {
    name: error.name,
    message: error.message,
    status: error.status,
  }
}

describe('BoundaryError', () => {
  it('sets the subclass name and preserves the message and cause', () => {
    const original = new Error('connection refused')
    const wrapped = new TaskStorePersistenceError('failed to save', original)

    expect(normalizeBoundaryError(wrapped)).toEqual({
      name: 'TaskStorePersistenceError',
      message: 'failed to save',
      cause: original,
    })
  })
})

describe('ApiError', () => {
  it('holds the HTTP status and message', () => {
    const error = new ApiError(404, 'Task not found')

    expect(normalizeApiError(error)).toEqual({
      name: 'ApiError',
      message: 'Task not found',
      status: 404,
    })
  })
})
