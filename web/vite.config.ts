import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

import { pwaManifest } from './src/lib/pwa-manifest'

export default defineConfig({
  plugins: [
    tanstackRouter({
      routesDirectory: './src/routes',
      generatedRouteTree: './src/routeTree.gen.ts',
      autoCodeSplitting: true,
    }),
    tailwindcss(),
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      // Cloudflare Access sits in front of the app, so the manifest fetch
      // must include the CF_Authorization cookie or Access redirects it to
      // the login page.
      useCredentials: true,
      manifest: pwaManifest,
      injectManifest: {
        // Precaching index.html would make the service worker answer `/`
        // navigations from cache, swallowing the Cloudflare Access login
        // redirect that a session-expiry reload depends on to recover
        // (see web/src/lib/session-aware-fetch.ts and the comment in
        // web/src/sw.ts).
        globIgnores: ['**/index.html'],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
