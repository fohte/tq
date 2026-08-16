import type { SuccessStatusCode } from 'hono/utils/http-status'
import {
  err,
  errAsync,
  ok,
  okAsync,
  type Result,
  ResultAsync,
} from 'neverthrow'

/**
 * Check that a Hono client response is successful, narrowing the returned
 * Ok value to its 2xx status variants. Use for endpoints where only the
 * success shape of `res.json()` is needed and non-2xx responses should be
 * treated as a failure.
 */
export function assertOk<R extends { status: number; ok: boolean }>(
  res: R,
): Result<Extract<R, { status: SuccessStatusCode }>, Error> {
  if (!res.ok) {
    return err(new Error(`API request failed: ${String(res.status)}`))
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- TS can't narrow a generic R by the res.ok check above; the check itself is the runtime guarantee
  return ok(res as Extract<R, { status: SuccessStatusCode }>)
}

/**
 * Check a specific status code, narrowing the returned Ok value to that
 * status's output type. Use for endpoints with more than one non-2xx
 * response shape, where `res.json()` would otherwise resolve to a union of
 * all of them.
 */
export function assertStatus<R extends { status: number }, S extends number>(
  res: R,
  status: S,
): Result<Extract<R, { status: S }>, Error> {
  if (res.status !== status) {
    return err(
      new Error(
        `API request failed: ${String(res.status)} (expected ${String(status)})`,
      ),
    )
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- TS can't narrow a generic R by the res.status check above; the check itself is the runtime guarantee
  return ok(res as Extract<R, { status: S }>)
}

/**
 * Like `assertOk`, but extract the server-provided `{ error: string }` body
 * on failure instead of a generic status-code message. Use for endpoints
 * whose error message is shown to the user.
 */
export function assertOkWithMessage<
  R extends { status: number; ok: boolean; json: () => Promise<unknown> },
>(res: R): ResultAsync<Extract<R, { status: SuccessStatusCode }>, Error> {
  if (!res.ok) {
    return ResultAsync.fromSafePromise(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- TS can't narrow a generic R's json() return by the res.ok check above; the check itself is the runtime guarantee
      res.json() as Promise<{ error: string }>,
    ).andThen((body) => errAsync(new Error(body.error)))
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- TS can't narrow a generic R by the res.ok check above; the check itself is the runtime guarantee
  return okAsync(res as Extract<R, { status: SuccessStatusCode }>)
}

/**
 * Unwrap a `Result`'s Ok value, or throw its Err value. Use at a boundary
 * (e.g. a React Query queryFn/mutationFn) that must throw to signal failure.
 */
export function unwrapOrThrow<T, E extends Error>(result: Result<T, E>): T {
  // eslint-disable-next-line no-restricted-syntax -- this function's entire purpose is to throw at a React Query queryFn/mutationFn boundary, which must throw to signal failure
  if (result.isErr()) throw result.error
  return result.value
}

/**
 * Like `assertOk`, but throws instead of returning a `Result`. Use at a
 * boundary (e.g. a React Query mutationFn) that only needs the
 * throw-on-failure effect and has no Ok value worth keeping.
 */
export function assertOkOrThrow(res: { status: number; ok: boolean }): void {
  // eslint-disable-next-line neverthrow/must-use-result -- unwrapOrThrow already handles the Result (throws on Err); the plugin can't see through a custom wrapper
  unwrapOrThrow(assertOk(res))
}

/**
 * Like `assertOkWithMessage`, but throws instead of returning a `Result`.
 * Use at a boundary (e.g. a React Query mutationFn) that only needs the
 * throw-on-failure effect and has no Ok value worth keeping.
 */
export async function assertOkWithMessageOrThrow(res: {
  status: number
  ok: boolean
  json: () => Promise<unknown>
}): Promise<void> {
  // eslint-disable-next-line neverthrow/must-use-result -- unwrapOrThrow already handles the Result (throws on Err); the plugin can't see through a custom wrapper
  unwrapOrThrow(await assertOkWithMessage(res))
}
