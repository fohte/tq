import { describe, expect, it, vi } from 'vitest'

import { pwaManifest } from '#lib/pwa-manifest'

const vitePWA = vi.fn(() => [])
vi.mock('vite-plugin-pwa', () => ({ VitePWA: vitePWA }))

describe('vite.config', () => {
  it('excludes index.html from the service worker precache manifest, so a session-expiry reload reaches the network instead of a cached shell', async () => {
    await import('./vite.config')

    expect(vitePWA).toHaveBeenCalledWith({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      useCredentials: true,
      manifest: pwaManifest,
      injectManifest: {
        globIgnores: ['**/index.html'],
      },
    })
  })
})
