function includes<T extends string>(
  arr: readonly T[],
  value: string,
): value is T {
  return (arr as readonly string[]).includes(value)
}

/**
 * Create an onChange handler for a <select> element that validates
 * the value against a set of valid options before calling the setter.
 */
export function selectHandler<T extends string>(
  setter: (value: T) => void,
  validValues: readonly T[],
): React.ChangeEventHandler<HTMLSelectElement> {
  return (e) => {
    if (includes(validValues, e.target.value)) {
      setter(e.target.value)
    }
  }
}

/**
 * Create an onValueChange handler for the Base UI `Select` primitive
 * (`#components/ui/select`) that validates the value against a set of valid
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
