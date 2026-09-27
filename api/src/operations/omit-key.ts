export const CONTENT_KEY = 'content'

export function omitKeyDeep(value: unknown, key: string): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => omitKeyDeep(item, key))
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([field]) => field !== key)
        .map(([field, nested]) => [field, omitKeyDeep(nested, key)]),
    )
  }
  return value
}
