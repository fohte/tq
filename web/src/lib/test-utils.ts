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
