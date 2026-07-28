import type { AppType } from 'api/types'
import { hc } from 'hono/client'

import { sessionAwareFetch } from '#lib/session-aware-fetch'

export const api = hc<AppType>('/', { fetch: sessionAwareFetch })
