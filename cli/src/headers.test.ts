import { err, ok } from 'neverthrow'
import { describe, expect, it } from 'vitest'

import { collectHeader, parseHeadersJson } from '#headers'

describe('collectHeader', () => {
  it('parses "Name: Value" into a header entry', () => {
    expect(collectHeader('Name: Value', {})).toEqual({ Name: 'Value' })
  })

  it('merges with previously collected headers', () => {
    const first = collectHeader('X-One: 1', {})
    const second = collectHeader('X-Two: 2', first)

    expect(second).toEqual({ 'X-One': '1', 'X-Two': '2' })
  })

  it('does not include the input when there is no colon separator', () => {
    expect(() => collectHeader('secret-value', {})).toThrow(
      new Error('Expected "Name: Value" format for --header.'),
    )
  })

  it('rejects an invalid header name', () => {
    expect(() => collectHeader('Bad Name: value', {})).toThrow(
      new Error('Invalid HTTP header name "Bad Name".'),
    )
  })

  it('rejects invalid value characters without including the value', () => {
    expect(() => collectHeader('X-Token: secret\r\ninjected', {})).toThrow(
      new Error('Invalid value for HTTP header "X-Token".'),
    )
  })
})

describe('parseHeadersJson', () => {
  it('parses a JSON object of string header values', () => {
    expect(parseHeadersJson('{"X-Example":"value"}')).toEqual(
      ok({ 'X-Example': 'value' }),
    )
  })

  it('returns no headers when the environment variable is unset', () => {
    expect(parseHeadersJson(undefined)).toEqual(ok({}))
  })

  it.each([
    ['an empty string', '', 'TQ_HEADERS_JSON must contain valid JSON.'],
    [
      'invalid JSON',
      '{"X-Example":"secret',
      'TQ_HEADERS_JSON must contain valid JSON.',
    ],
    ['a non-object JSON value', '[]', 'TQ_HEADERS_JSON must be a JSON object.'],
    [
      'a non-string header value',
      '{"X-Example":42}',
      'TQ_HEADERS_JSON value for header "X-Example" must be a string.',
    ],
    [
      'an invalid header name',
      '{"Bad Name":"secret"}',
      'TQ_HEADERS_JSON: Invalid HTTP header name "Bad Name".',
    ],
    [
      'an invalid header value',
      JSON.stringify({ 'X-Example': 'secret\r\ninjected' }),
      'TQ_HEADERS_JSON: Invalid value for HTTP header "X-Example".',
    ],
  ])('rejects %s without exposing header values', (_case, raw, message) => {
    const actual = parseHeadersJson(raw).mapErr((error) => error.message)
    expect(actual).toEqual(err(message))
  })
})
