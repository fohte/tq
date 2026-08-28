/**
 * Retrieve an element from an array, throwing if it is undefined.
 * Useful in tests to replace non-null assertions (`arr[0]!`) with a
 * runtime check that produces a clear failure message.
 */
export function atIndex<T>(arr: T[], index: number): T {
  const value = arr[index]
  if (value === undefined) {
    // eslint-disable-next-line no-restricted-syntax -- this file itself isn't a *.test.ts file, so it's outside the vitest test-file glob that `@fohte/eslint-config` exempts from must-use-result
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
export function defined<T>(
  value: T | null | undefined,
  message = 'Expected value to be defined',
): T {
  if (value == null) {
    // eslint-disable-next-line no-restricted-syntax -- this file itself isn't a *.test.ts file, so it's outside the vitest test-file glob that `@fohte/eslint-config` exempts from must-use-result
    throw new Error(message)
  }
  return value
}
