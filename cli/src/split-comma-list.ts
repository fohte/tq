// A comma-containing id/number or label/days-of-week entry can't be
// represented this way and will be split into multiple entries; accepted
// since ids/numbers and days-of-week digits never contain commas, and
// existing label names (e.g. `sample/topic`) don't either.
export function splitCommaList(raw: string): string[] {
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
}
