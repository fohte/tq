import { expect, waitFor } from 'storybook/test'

export { defined as assertDefined, atIndex } from 'api/lib/test-utils'

/**
 * Find the element actually visible among duplicates (e.g. a component that
 * mounts both a desktop and a mobile variant and toggles them via CSS).
 */
export function findVisible<T extends Element>(elements: T[]): T | undefined {
  return elements.find((el) => el.checkVisibility())
}

/**
 * Base UI's Popover moves focus into its content asynchronously (via
 * `requestAnimationFrame`) after opening, targeting the first tabbable
 * element by default. Wait for that focus to land on `element` before
 * interacting with a different one in the same popup, or it can steal focus
 * back afterward.
 */
export async function waitForFocus(element: Element): Promise<void> {
  await waitFor(() => expect(element).toHaveFocus())
}
