// Comma-separated flags cannot represent a single value containing a comma.
export function splitCommaList(raw: string): string[] {
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
}
