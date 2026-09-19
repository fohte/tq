import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

async function captureImportError(): Promise<Error> {
  try {
    await import('#config')
  } catch (error) {
    if (error instanceof Error) return error
    throw error
  }
  throw new Error('expected import(#config) to throw')
}

describe('TQ_ORIGIN', () => {
  it('rejects a missing value', async () => {
    vi.stubEnv('TQ_ORIGIN', '')

    const error = await captureImportError()

    expect(error.message).toBe('TQ_ORIGIN environment variable is required')
  })

  it('rejects a value without a scheme', async () => {
    vi.stubEnv('TQ_ORIGIN', 'tq.example.com')

    const error = await captureImportError()

    expect(error.message).toBe(
      'TQ_ORIGIN must start with http:// or https://, e.g. https://tq.example.com (got: tq.example.com)',
    )
  })

  it('rejects a non-http(s) scheme', async () => {
    vi.stubEnv('TQ_ORIGIN', 'ftp://tq.example.com')

    const error = await captureImportError()

    expect(error.message).toBe(
      'TQ_ORIGIN must start with http:// or https://, e.g. https://tq.example.com (got: ftp://tq.example.com)',
    )
  })

  it('accepts an https URL', async () => {
    vi.stubEnv('TQ_ORIGIN', 'https://tq.example.com')

    const { TQ_ORIGIN } = await import('#config')

    expect(TQ_ORIGIN).toBe('https://tq.example.com')
  })
})

describe('EXTERNAL_SCHEMES', () => {
  it('defaults to none', async () => {
    vi.stubEnv('TQ_ORIGIN', 'https://tq.example.com')

    const { EXTERNAL_SCHEMES } = await import('#config')

    expect(EXTERNAL_SCHEMES).toEqual([])
  })

  it('splits a comma-separated list, trimming and lowercasing each scheme', async () => {
    vi.stubEnv('TQ_ORIGIN', 'https://tq.example.com')
    vi.stubEnv('TQ_EXTERNAL_SCHEMES', ' Example-App, other-app ,,')

    const { EXTERNAL_SCHEMES } = await import('#config')

    expect(EXTERNAL_SCHEMES).toEqual(['example-app', 'other-app'])
  })
})
