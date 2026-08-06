import type { Command } from 'commander'

import type { Client } from '#client'
import { createClient } from '#client'

export interface GlobalOptions {
  apiUrl?: string
  header: Record<string, string>
}

export function resolveApiUrl(options: GlobalOptions): string {
  if (options.apiUrl != null && options.apiUrl.length > 0) {
    return options.apiUrl
  }
  throw new Error(
    'API URL is not set. Pass --api-url or set the TQ_API_URL environment variable.',
  )
}

export function buildClient(command: Command, fetchImpl: typeof fetch): Client {
  const options = command.optsWithGlobals<GlobalOptions>()
  const apiUrl = resolveApiUrl(options)
  return createClient({ apiUrl, headers: options.header }, fetchImpl)
}
