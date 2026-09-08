/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

import {
  parsePushNotification,
  readNotificationUrl,
  resolveNotificationClickAction,
} from '#lib/push-notification'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Parameters<typeof precacheAndRoute>[0]
}

void self.skipWaiting()
clientsClaim()

// Never add a navigation fallback route here. Cloudflare Access answers an
// expired session with a cross-origin redirect to its login page, which a
// service worker responding to navigations swallows.
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

self.addEventListener('push', (event) => {
  const { title, options } = parsePushNotification(event.data?.text())
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const url = readNotificationUrl(event.notification.data)
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        const action = resolveNotificationClickAction(clients, url)
        switch (action.kind) {
          case 'focus':
            return action.client.focus()
          case 'navigate':
            return (
              action.client
                .focus()
                .then((client) => client.navigate(action.url))
                // navigate() rejects on a client this worker does not control.
                .catch(() => self.clients.openWindow(action.url))
            )
          case 'open':
            return self.clients.openWindow(action.url)
        }
      }),
  )
})
