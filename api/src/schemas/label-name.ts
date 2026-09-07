import { z } from 'zod'

// A label name doubles as a `/`-separated hierarchy path (e.g. `dev/tq`); an
// empty segment has no valid position in that hierarchy.
export const labelNameSchema = z
  .string()
  .trim()
  .min(1)
  .refine((name) => !name.split('/').some((segment) => segment === ''), {
    message: 'Label name must not contain empty path segments',
  })
