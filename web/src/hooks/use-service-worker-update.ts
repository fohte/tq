import { useOnAppForeground } from '#hooks/use-on-app-foreground'

function checkForServiceWorkerUpdate(): void {
  if (!('serviceWorker' in navigator)) return

  void navigator.serviceWorker
    .getRegistration()
    .then((registration) => registration?.update())
    .catch((error: unknown) => {
      console.error('failed to check for a service worker update', error)
    })
}

/**
 * The registration script injected by vite-plugin-pwa only checks for
 * updates on page load. This hook repeats the check on foreground return;
 * sw.ts's skipWaiting()/clientsClaim() then take over without a reload.
 */
export function useServiceWorkerUpdate(): void {
  useOnAppForeground(checkForServiceWorkerUpdate)
}
