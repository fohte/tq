import type { Command } from 'commander'
import { err, ok, Result } from 'neverthrow'

import type { Client } from '#client'
import { createClient } from '#client'

interface GlobalOptions {
  apiUrl?: string
  author?: string
  header: Record<string, string>
}

export function resolveApiUrl(command: Command): Result<string, Error> {
  const options = command.optsWithGlobals<GlobalOptions>()
  if (options.apiUrl != null && options.apiUrl.length > 0) {
    return ok(options.apiUrl)
  }
  return err(
    new Error(
      'API URL is not set. Pass --api-url or set the TQ_API_URL environment variable.',
    ),
  )
}

function resolveHeaders(options: GlobalOptions): Record<string, string> {
  if (options.author == null || options.author.length === 0) {
    return options.header
  }
  return { 'X-Author': `llm:${options.author}`, ...options.header }
}

export function buildClient(
  command: Command,
  fetchImpl: typeof fetch,
): Result<Client, Error> {
  const options = command.optsWithGlobals<GlobalOptions>()
  return resolveApiUrl(command).map((apiUrl) =>
    createClient({ apiUrl, headers: resolveHeaders(options) }, fetchImpl),
  )
}
