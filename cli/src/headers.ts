import { InvalidArgumentError } from 'commander'

export function collectHeader(
  value: string,
  previous: Record<string, string>,
): Record<string, string> {
  const separatorIndex = value.indexOf(':')
  if (separatorIndex === -1) {
    // commander's argParser contract requires throwing InvalidArgumentError;
    // commander itself catches it and converts it into user-facing CLI error
    // output, so this can't return a Result.
    // eslint-disable-next-line no-restricted-syntax -- commander's argParser contract requires a synchronous throw
    throw new InvalidArgumentError(`Expected "Name: Value", got: ${value}`)
  }
  const name = value.slice(0, separatorIndex).trim()
  const headerValue = value.slice(separatorIndex + 1).trim()
  return { ...previous, [name]: headerValue }
}
