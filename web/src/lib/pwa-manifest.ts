import type { ManifestOptions } from 'vite-plugin-pwa'

export const pwaManifest: Partial<ManifestOptions> = {
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
}
