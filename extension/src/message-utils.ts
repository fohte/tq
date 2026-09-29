export function hasMessageType<T extends string>(
  message: unknown,
  type: T,
): message is { type: T } {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as { type?: unknown }).type === type
  )
}
