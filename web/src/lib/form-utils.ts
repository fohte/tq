function includes<T extends string>(
  arr: readonly T[],
  value: string,
): value is T {
  return (arr as readonly string[]).includes(value)
}

/**
 * Create an onValueChange handler for the Base UI `Select` primitive
 * (`@fohte/ui/select`) that validates the value against a set of valid
 * options before calling the setter.
 */
export function selectValueHandler<T extends string>(
  setter: (value: T) => void,
  validValues: readonly T[],
): (value: string | null) => void {
  return (value) => {
    if (value != null && includes(validValues, value)) {
      setter(value)
    }
  }
}
