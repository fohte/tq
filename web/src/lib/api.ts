import { sessionAwareFetch } from '@web/lib/session-aware-fetch'
import type { AppType } from 'api/types'
import { hc } from 'hono/client'

export const api = hc<AppType>('/', { fetch: sessionAwareFetch })
