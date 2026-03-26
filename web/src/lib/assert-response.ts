import type { ClientResponse } from 'hono/client'

/**
 * Assert that a Hono client response is successful.
 * TypeScript types the response as always ok, but network errors
 * or server issues could cause failures at runtime.
 */
export function assertOk(res: ClientResponse<unknown>): void {
  if (!res.ok) {
    throw new Error(`API request failed: ${String(res.status)}`)
  }
}
