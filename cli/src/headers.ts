import { err, ok, Result } from 'neverthrow'

import { tryParseJson } from '#result'

const headerNamePattern = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/
const headerValuePattern = /^[\t\x20-\xFF]*$/

function validateHeader(name: string, value: string): Result<void, Error> {
  if (!headerNamePattern.test(name)) {
    return err(new Error(`Invalid HTTP header name ${JSON.stringify(name)}.`))
  }
  if (!headerValuePattern.test(value)) {
    return err(
      new Error(`Invalid value for HTTP header ${JSON.stringify(name)}.`),
    )
  }
  return ok(undefined)
}

export function parseHeadersJson(
  raw: string | undefined,
): Result<Record<string, string>, Error> {
  if (raw == null) return ok({})

  return tryParseJson(raw)
    .mapErr(() => new Error('TQ_HEADERS_JSON must contain valid JSON.'))
    .andThen((parsed): Result<Record<string, string>, Error> => {
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        Array.isArray(parsed)
      ) {
        return err(new Error('TQ_HEADERS_JSON must be a JSON object.'))
      }

      const entries: Array<[string, string]> = []
      for (const [name, value] of Object.entries(parsed)) {
        if (typeof value !== 'string') {
          return err(
            new Error(
              `TQ_HEADERS_JSON value for header ${JSON.stringify(name)} must be a string.`,
            ),
          )
        }
        const validation = validateHeader(name, value)
        if (validation.isErr()) {
          return err(new Error(`TQ_HEADERS_JSON: ${validation.error.message}`))
        }
        entries.push([name, value])
      }
      return ok(Object.fromEntries(entries))
    })
}

export function mergeHeaders(
  ...sources: Array<Record<string, string>>
): Result<Record<string, string>, Error> {
  const entries = sources.flatMap((source) => Object.entries(source))
  const validation = Result.combine(
    entries.map(([name, value]) => validateHeader(name, value)),
  )

  return validation.map(() => {
    const merged = new Map<string, string>()
    // An overwritten key keeps its object position, which can reverse priority
    // when a differently cased duplicate was added between writes.
    for (const [name, value] of entries) {
      merged.set(name.toLowerCase(), value)
    }
    return Object.fromEntries(merged)
  })
}

export function collectHeader(
  value: string,
  previous: Record<string, string>,
): Record<string, string> {
  const separatorIndex = value.indexOf(':')
  if (separatorIndex === -1) {
    // Commander's argParser is synchronous and its invalid-argument formatter
    // includes the raw value, so this must throw a sanitized plain Error.
    // eslint-disable-next-line no-restricted-syntax -- commander's argParser contract requires a synchronous throw
    throw new Error('Expected "Name: Value" format for --header.')
  }
  const name = value.slice(0, separatorIndex).replace(/^[ \t]+|[ \t]+$/g, '')
  const rawHeaderValue = value.slice(separatorIndex + 1)
  const validation = validateHeader(name, rawHeaderValue)
  if (validation.isErr()) {
    // eslint-disable-next-line no-restricted-syntax -- commander's argParser contract requires a synchronous throw
    throw new Error(validation.error.message)
  }
  const headerValue = rawHeaderValue.trim()
  return { ...previous, [name]: headerValue }
}
