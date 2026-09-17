import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('TQ_ORIGIN', () => {
  it('rejects a value without a scheme', async () => {
    vi.stubEnv('TQ_ORIGIN', 'tq.fohte.net')

    await expect(import('#config')).rejects.toThrow(
      'TQ_ORIGIN must start with http:// or https://, e.g. https://tq.fohte.net (got: tq.fohte.net)',
    )
  })

  it('rejects a non-http(s) scheme', async () => {
    vi.stubEnv('TQ_ORIGIN', 'ftp://tq.fohte.net')

    await expect(import('#config')).rejects.toThrow(
      'TQ_ORIGIN must start with http:// or https://, e.g. https://tq.fohte.net (got: ftp://tq.fohte.net)',
    )
  })

  it('accepts an https URL', async () => {
    vi.stubEnv('TQ_ORIGIN', 'https://tq.fohte.net')

    const { TQ_ORIGIN } = await import('#config')

    expect(TQ_ORIGIN).toBe('https://tq.fohte.net')
  })
})
