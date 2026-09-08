import { useOnAppForeground } from '#hooks/use-on-app-foreground'

function checkForServiceWorkerUpdate(): void {
  if (!('serviceWorker' in navigator)) return

  void navigator.serviceWorker.getRegistration().then((registration) => {
    void registration?.update()
  })
}

// The registration script vite-plugin-pwa injects only registers the service
// worker on page load and never checks again. Combined with skipWaiting() and
// clientsClaim() in sw.ts, forcing that check here is what lets a new service
// worker (e.g. one that adds a push handler) take over an already-open PWA.
export function useServiceWorkerUpdate(): void {
  useOnAppForeground(checkForServiceWorkerUpdate)
}
