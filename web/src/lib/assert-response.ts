import type { SuccessStatusCode } from 'hono/utils/http-status'

/**
 * Assert that a Hono client response is successful, narrowing the response
 * to its 2xx status variants. Use for endpoints where only the success
 * shape of `res.json()` is needed and non-2xx responses should throw.
 */
export function assertOk<R extends { status: number; ok: boolean }>(
  res: R,
): asserts res is Extract<R, { status: SuccessStatusCode }> {
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
