/**
 * Retrieve an element from an array, throwing if it is undefined.
 * Useful in tests to replace non-null assertions (`arr[0]!`) with a
 * runtime check that produces a clear failure message.
 */
export function atIndex<T>(arr: T[], index: number): T {
  const value = arr[index]
  if (value === undefined) {
    // eslint-disable-next-line no-restricted-syntax -- test-only assertion helper called from *.test.tsx and *.stories.tsx; wrapping in a Result would force every .stories.tsx call site (not exempt from must-use-result) to unwrap it for no real safety gain
    throw new Error(
      `Expected element at index ${String(index)}, but array length is ${String(arr.length)}`,
    )
  }
  return value
}

/**
 * Assert that a value is not null/undefined and return it with a narrowed type.
 * Replaces non-null assertions (`value!`) in test code.
 */
export function assertDefined<T>(
  value: T | null | undefined,
  message = 'Expected value to be defined',
): T {
  if (value == null) {
    // eslint-disable-next-line no-restricted-syntax -- test-only assertion helper called from *.test.tsx and *.stories.tsx; wrapping in a Result would force every .stories.tsx call site (not exempt from must-use-result) to unwrap it for no real safety gain
    throw new Error(message)
  }
  return value
}

/**
 * Find the element actually visible among duplicates (e.g. a component that
 * mounts both a desktop and a mobile variant and toggles them via CSS).
 */
export function findVisible<T extends Element>(elements: T[]): T | undefined {
  return elements.find((el) => el.checkVisibility())
}
