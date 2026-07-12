import { fileURLToPath, URL } from 'node:url'

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
        // workbox-build's generateSW template always registers the
        // navigateFallback NavigationRoute before any runtimeCaching route,
        // so a runtimeCaching rule can never intercept navigations ahead of
        // it. vite-plugin-pwa also defaults navigateFallback to
        // 'index.html', so it must be explicitly unset here. Route
        // navigations through runtimeCaching instead: NetworkFirst fetches
        // navigations from the network first (so a Cloudflare Access
        // session expiry is caught on reload) and falls back to the
        // precached shell only when the network is unavailable.
        navigateFallback: null,
        runtimeCaching: [
          {
            urlPattern: ({ request, url }) =>
              request.mode === 'navigate' && !/^\/api\//.test(url.pathname),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages',
              precacheFallback: {
                fallbackURL: '/index.html',
              },
            },
          },
        ],
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
  resolve: {
    alias: {
      '@web': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
