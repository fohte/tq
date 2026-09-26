import type { ExtractSchema } from 'hono/types'

import type { AppType } from '#app'

type Schema = ExtractSchema<AppType>

/** Every method/path pair registered by the Hono application. */
export type AllRoutes = {
  [Path in keyof Schema]: {
    [Method in keyof Schema[Path]]: Method extends `$${infer M}`
      ? `${Uppercase<M>} ${Path}`
      : never
  }[keyof Schema[Path]]
}[keyof Schema]
