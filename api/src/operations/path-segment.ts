import { z } from 'zod'

export function pathSegmentSchema(label: string) {
  return z
    .string()
    .min(1)
    .refine((value) => value !== '.' && value !== '..', {
      message: `${label} must be a valid path segment`,
    })
}

export function encodePathSegment(value: string): string {
  return encodeURIComponent(value)
}
