// A comma-containing id/number or label/days-of-week entry can't be
// represented this way and will be split into multiple entries; accepted
// since ids/numbers and days-of-week digits never contain commas, and
// existing label names (e.g. `dev/tq`) don't either.
export function splitCommaList(raw: string): string[] {
  return raw
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v.length > 0)
}
