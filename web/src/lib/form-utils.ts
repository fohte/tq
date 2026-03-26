/**
 * Create an onChange handler for a <select> element.
 * The cast from string to the setter's expected type is safe
 * because <select> options are statically defined.
 */
export function selectHandler(
  setter: (value: never) => void,
): React.ChangeEventHandler<HTMLSelectElement> {
  return (e) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    ;(setter as (value: string) => void)(e.target.value)
  }
}
