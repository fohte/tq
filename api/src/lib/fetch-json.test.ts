import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { errorMessage, fetchJson, fetchJsonConditional } from '#lib/fetch-json'

class TestApiError extends Error {
  readonly rejected: boolean

  constructor(message: string, cause?: unknown, rejected = false) {
    super(message, { cause })
    this.name = 'TestApiError'
    this.rejected = rejected
  }
}

const wrapError = (message: string, cause?: unknown, rejected?: boolean) =>
  new TestApiError(message, cause, rejected)

const schema = z.object({ ok: z.boolean() })

afterEach(() => {
  vi.restoreAllMocks()
})

describe('fetchJson', () => {
  it('retries once and succeeds when a GET request hits a transient network failure', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      )

    const result = await fetchJson('https://example.com', {}, schema, wrapError)

    expect(result._unsafeUnwrap()).toEqual({ ok: true })
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('does not retry a POST request after a transient network failure', async () => {
    const cause = new TypeError('fetch failed')
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(cause)

    const result = await fetchJson(
      'https://example.com',
      { method: 'POST' },
      schema,
      wrapError,
    )

    expect(result._unsafeUnwrapErr()).toEqual(
      new TestApiError(errorMessage(cause), cause),
    )
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('surfaces an error when a GET request keeps failing after the retry', async () => {
    const cause = new TypeError('fetch failed')
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(cause)
      .mockRejectedValueOnce(cause)

    const result = await fetchJson('https://example.com', {}, schema, wrapError)

    expect(result._unsafeUnwrapErr()).toEqual(
      new TestApiError(errorMessage(cause), cause),
    )
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })
})

describe('fetchJsonConditional', () => {
  it('retries once and reports notModified when a GET request hits a transient network failure', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(new Response(null, { status: 304 }))

    const result = await fetchJsonConditional(
      'https://example.com',
      {},
      schema,
      wrapError,
    )

    expect(result._unsafeUnwrap()).toEqual({ notModified: true })
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })
})
