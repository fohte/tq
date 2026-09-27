import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('ASSET_MAX_SIZE_BYTES', () => {
  it('uses the configured byte limit', async () => {
    vi.stubEnv('ASSET_MAX_SIZE_BYTES', '2048')
    vi.resetModules()

    const { ASSET_MAX_SIZE_BYTES } = await import('#env')

    expect(ASSET_MAX_SIZE_BYTES).toBe(2048)
  })

  it('defaults to 10 MiB when unset', async () => {
    vi.stubEnv('ASSET_MAX_SIZE_BYTES', undefined)
    vi.resetModules()

    const { ASSET_MAX_SIZE_BYTES } = await import('#env')

    expect(ASSET_MAX_SIZE_BYTES).toBe(10 * 1024 * 1024)
  })
})
