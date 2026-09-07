import { z } from 'zod'

// A label name doubles as a `/`-separated hierarchy path (e.g. `dev/tq`), so
// an empty segment (`dev/`, `/tq`, `dev//tq`) would produce a tree node with
// no displayable name.
export const labelNameSchema = z
  .string()
  .trim()
  .min(1)
  .refine((name) => !name.split('/').some((segment) => segment === ''), {
    message: 'Label name must not contain empty path segments',
  })
