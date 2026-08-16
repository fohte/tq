import type { Result, ResultAsync } from 'neverthrow'

// commands/*.ts action handlers propagate failures via exceptions:
// commander's parseAsync rejects on a throw, and cli.ts's top-level catch
// turns that into the process exit code. Consuming a common helper's Result
// means unwrapping it back into that same throw-based flow at the call site.
export function unwrap<T, E extends Error>(result: Result<T, E>): T {
  return result.match(
    (value) => value,
    (error) => {
      throw error
    },
  )
}

export function unwrapAsync<T, E extends Error>(
  result: ResultAsync<T, E>,
): Promise<T> {
  return result.match(
    (value) => value,
    (error) => {
      throw error
    },
  )
}
