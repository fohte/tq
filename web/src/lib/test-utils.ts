export { defined as assertDefined, atIndex } from 'api/lib/test-utils'

/**
 * Find the element actually visible among duplicates (e.g. a component that
 * mounts both a desktop and a mobile variant and toggles them via CSS).
 */
export function findVisible<T extends Element>(elements: T[]): T | undefined {
  return elements.find((el) => el.checkVisibility())
}
