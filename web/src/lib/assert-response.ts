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

/**
 * Assert a specific status code, narrowing the response to that status's
 * output type. Use for endpoints with more than one non-2xx response shape,
 * where `res.json()` would otherwise resolve to a union of all of them.
 */
export function assertStatus<R extends { status: number }, S extends number>(
  res: R,
  status: S,
): asserts res is Extract<R, { status: S }> {
  if (res.status !== status) {
    throw new Error(
      `API request failed: ${String(res.status)} (expected ${String(status)})`,
    )
  }
}
