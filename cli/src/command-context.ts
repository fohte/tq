import type { Command } from 'commander'
import { err, ok, Result } from 'neverthrow'

import type { Client } from '#client'
import { createClient } from '#client'
import { mergeHeaders, parseHeadersJson } from '#headers'

interface GlobalOptions {
  apiUrl?: string
  webUrl?: string
  author?: string
  header?: Record<string, string>
}

function resolveApiUrl(command: Command): Result<string, Error> {
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

// Separate from the API base URL because they differ outside the production
// deployment (e.g. the API and Vite dev servers run on different ports in
// development), even though the production nginx config serves both from
// the same origin — see README.md's "Web container runtime" section.
export function resolveWebUrl(command: Command): Result<string, Error> {
  const options = command.optsWithGlobals<GlobalOptions>()
  if (options.webUrl != null && options.webUrl.length > 0) {
    return ok(options.webUrl)
  }
  return resolveApiUrl(command)
}

function resolveHeaders(
  options: GlobalOptions,
): Result<Record<string, string>, Error> {
  const authorHeaders =
    options.author == null || options.author.length === 0
      ? {}
      : { 'X-Author': `llm:${options.author}` }

  return parseHeadersJson(process.env['TQ_HEADERS_JSON']).andThen(
    (envHeaders) =>
      mergeHeaders(authorHeaders, envHeaders, options.header ?? {}),
  )
}

export function buildClient(
  command: Command,
  fetchImpl: typeof fetch,
): Result<Client, Error> {
  const options = command.optsWithGlobals<GlobalOptions>()
  return resolveApiUrl(command).andThen((apiUrl) =>
    resolveHeaders(options).map((headers) =>
      createClient({ apiUrl, headers }, fetchImpl),
    ),
  )
}
