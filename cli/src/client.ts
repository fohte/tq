import type { AppType } from 'api/types'
import { hc } from 'hono/client'

import { ApiError, NetworkError } from '#errors'

export type Client = ReturnType<typeof hc<AppType>>

export interface ClientConfig {
  apiUrl: string
  headers: Record<string, string>
}

export function createClient(
  { apiUrl, headers }: ClientConfig,
  fetchImpl: typeof fetch = fetch,
): Client {
  return hc<AppType>(apiUrl, {
    fetch: async (input: string | URL | Request, init?: RequestInit) => {
      const merged = new Headers(init?.headers)
      for (const [name, value] of Object.entries(headers)) {
        merged.set(name, value)
      }
      try {
        return await fetchImpl(input, { ...init, headers: merged })
      } catch (cause) {
        throw new NetworkError(`Failed to reach ${apiUrl}`, cause)
      }
    },
  })
}

export async function toApiError(res: Response): Promise<ApiError> {
  const body = await res.text()
  return new ApiError(res.status, extractErrorMessage(body))
}

function extractErrorMessage(body: string): string {
  if (body.length === 0) return body
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    return body
  }
  if (
    typeof parsed === 'object' &&
    parsed !== null &&
    'error' in parsed &&
    typeof parsed.error === 'string'
  ) {
    return parsed.error
  }
  return body
}
