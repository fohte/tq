export function optionString(
  options: Record<string, unknown>,
  name: string,
): string | undefined {
  const value = options[name]
  return typeof value === 'string' ? value : undefined
}
