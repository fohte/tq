import { expect, waitFor } from 'storybook/test'
import { vi } from 'vitest'

export { defined as assertDefined, atIndex } from 'api/lib/test-utils'

/**
 * Find the element actually visible among duplicates (e.g. a component that
 * mounts both a desktop and a mobile variant and toggles them via CSS).
 */
export function findVisible<T extends Element>(elements: T[]): T | undefined {
  return elements.find((el) => el.checkVisibility())
}

/**
 * Waits until `element` receives focus.
 */
export async function waitForFocus(element: Element): Promise<void> {
  await waitFor(() => expect(element).toHaveFocus())
}

/**
 * Base UI's Select popup keeps `pointer-events: none` on its positioner
 * until the `open` state commit lands, so a click right after opening the
 * trigger can race that commit — retry until it succeeds.
 */
export async function clickSelectOption(
  userEvent: { click: (element: Element) => Promise<unknown> },
  option: Element,
): Promise<void> {
  await waitFor(() => userEvent.click(option))
}

/**
 * Casts a partial hook-return mock to its full type. Named after its
 * original `useMutation` use case, but works for any hook's return value
 * (`useQuery`, `useTaskList`, ...) — callers only set the fields their test
 * reads, never the ones it doesn't.
 */
export function partialMutation<T>(partial: Partial<T>): T {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- partial mock of hook return value
  return partial as T
}

/**
 * Mock `mutate` that synchronously invokes the caller's `onSuccess` option.
 * Only fits a `useMutation`-shaped hook whose success handler ignores every
 * argument `mutate` receives.
 */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- TMutate exists so callers can pin the return type to their hook's `mutate` signature; the cast below is inherently unchecked
export function mutateInvokingOnSuccess<TMutate>(): TMutate {
  const mock = (_variables: unknown, options?: { onSuccess?: () => void }) => {
    options?.onSuccess?.()
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test double: caller's onSuccess handler ignores every argument, so the exact mutate signature doesn't matter here
  return vi.fn(mock) as TMutate
}

/**
 * Matches the `{ onSuccess }` options object a `mutate` call passes, without
 * asserting the callback's identity.
 */
export const withOnSuccess = {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- vitest's expect.any() return type isn't generic, so TS can only type this property as `any`
  onSuccess: expect.any(Function),
}

/**
 * Parses the JSON body of a mocked `PUT /api/queues/:key/items` request.
 * Callers only register this handler for a request whose body they
 * constructed themselves via `useSetQueueItems`'s `mutate` call, so the cast
 * is safe.
 */
export async function readQueuePutBody(
  request: Request,
): Promise<{ date: string; taskIds: string[] }> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- see doc comment above
  return (await request.json()) as { date: string; taskIds: string[] }
}
