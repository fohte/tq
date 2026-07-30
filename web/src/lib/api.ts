import type { AppType } from 'api/types'
import { hc } from 'hono/client'

import { sessionAwareFetch } from '#lib/session-aware-fetch'

// Every request from the web app is human-initiated, so it's tagged here
// once rather than at each call site.
function fetchWithAuthor(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers)
  headers.set('X-Author', 'human')
  return sessionAwareFetch(input, { ...init, headers })
}

export const api = hc<AppType>('/', { fetch: fetchWithAuthor })
