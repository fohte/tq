import type { AppType } from 'api/types'
import { hc } from 'hono/client'

const apiUrl: string =
  import.meta.env['VITE_API_URL'] ?? 'http://localhost:3001'

export const api = hc<AppType>(apiUrl)
