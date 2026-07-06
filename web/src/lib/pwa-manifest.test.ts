import { pwaManifest } from '@web/lib/pwa-manifest'
import { describe, expect, it } from 'vitest'

describe('pwaManifest', () => {
  it('provides a valid Web App Manifest for standalone home screen installs', () => {
    expect(pwaManifest).toEqual({
      name: 'tq',
      short_name: 'tq',
      description: '個人向けタスク管理ツール',
      theme_color: '#111111',
      background_color: '#111111',
      display: 'standalone',
      start_url: '/',
      scope: '/',
      lang: 'ja',
      icons: [
        {
          src: 'icon-192.png',
          sizes: '192x192',
          type: 'image/png',
        },
        {
          src: 'icon-512.png',
          sizes: '512x512',
          type: 'image/png',
        },
        {
          src: 'maskable-icon-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    })
  })
})
