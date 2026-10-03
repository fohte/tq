import { describe, expect, it } from 'vitest'

import { BoundaryError } from '#errors'

class TaskStorePersistenceError extends BoundaryError {}

function normalizeBoundaryError(error: Error) {
  return {
    name: error.name,
    message: error.message,
    cause: error.cause,
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
