import { z } from 'zod'

function isWellFormedUnicode(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code >= 0xd800 && code <= 0xdbff) {
      const nextCode = value.charCodeAt(index + 1)
      if (!(nextCode >= 0xdc00 && nextCode <= 0xdfff)) return false
      index += 1
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return false
    }
  }
  return true
}

export function pathSegmentSchema(label: string) {
  return z
    .string()
    .min(1)
    .refine(
      (value) => value !== '.' && value !== '..' && isWellFormedUnicode(value),
      {
        message: `${label} must be a valid path segment`,
      },
    )
}

export function encodePathSegment(value: string): string {
  return encodeURIComponent(value)
}
