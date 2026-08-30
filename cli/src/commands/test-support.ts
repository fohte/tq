import { Readable } from 'node:stream'

import { vi } from 'vitest'

import type { ReadableStdin } from '#input'

export interface CapturedRequest {
  method: string
  url: string
  headers: Record<string, string>
  body: unknown
}

export function captureFetch(respond: () => Response): {
  fetchStub: typeof fetch
  calls: CapturedRequest[]
} {
  const calls: CapturedRequest[] = []
  const fetchStub = ((input: string | URL | Request, init?: RequestInit) => {
    const headers = new Headers(init?.headers)
    calls.push({
      method: init?.method ?? 'GET',
      url:
        input instanceof URL
          ? input.toString()
          : input instanceof Request
            ? input.url
            : input,
      headers: Object.fromEntries(headers.entries()),
      body:
        typeof init?.body === 'string' && init.body.length > 0
          ? (JSON.parse(init.body) as unknown)
          : undefined,
    })
    return Promise.resolve(respond())
  }) as typeof fetch
  return { fetchStub, calls }
}

// Normalizes a captured request into one comparable value, so a test can
// assert the whole request shape (method/path/query/body) with a single
// `toEqual` instead of checking each part separately.
export function request(call: CapturedRequest | undefined) {
  const url = new URL(call?.url ?? '')
  const query: Record<string, string | string[]> = {}
  for (const key of new Set(url.searchParams.keys())) {
    const values = url.searchParams.getAll(key)
    query[key] = values.length > 1 ? values : (values[0] ?? '')
  }
  return {
    method: call?.method,
    pathname: url.pathname,
    query,
    body: call?.body,
  }
}

export function fakeStdin(isTTY: boolean): ReadableStdin {
  const readable = Readable.from([])
  return Object.assign(readable, { isTTY })
}

export function spyStdout() {
  return vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
}

export function spyStderr() {
  return vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
}

export const apiUrl = 'http://api.test'
