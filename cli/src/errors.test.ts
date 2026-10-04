import { describe, expect, it } from 'vitest'

import { ApiError } from '#errors'

function normalizeApiError(error: ApiError) {
  return {
    name: error.name,
    message: error.message,
    status: error.status,
  }
}

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
