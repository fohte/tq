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
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: pwaManifest,
      workbox: {
        // Navigation requests must reach the network uncontrolled. This
        // origin sits behind Cloudflare Access, which answers an expired
        // session with a cross-origin redirect to its login page; any
        // service-worker response for a navigation (precached shell,
        // NetworkFirst fallback, etc.) swallows that redirect and leaves the
        // session unrecoverable short of unregistering the worker.
        // vite-plugin-pwa defaults navigateFallback to 'index.html', so it
        // must be explicitly unset here.
        navigateFallback: null,
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
