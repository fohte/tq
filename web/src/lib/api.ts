import type { AppType } from 'api/types'
import { hc } from 'hono/client'

const apiUrl: string =
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- import.meta.env values are strings
  (import.meta.env['VITE_API_URL'] as string | undefined) ??
  'http://localhost:3001'

export const api = hc<AppType>(apiUrl)
