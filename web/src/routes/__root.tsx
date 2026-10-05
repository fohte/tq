import { createRootRoute, Outlet, useRouterState } from '@tanstack/react-router'

import { AppLayout } from '#components/layout/app-layout'
import { CompactLayoutFrame } from '#components/layout/compact-layout-frame'
import { useGithubSync } from '#hooks/use-github-link'
import { usePushResubscribe } from '#hooks/use-push-notifications'
import { useServiceWorkerUpdate } from '#hooks/use-service-worker-update'
import { isCompactDayLayoutSearch } from '#lib/compact-layout'

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  useGithubSync()
  useServiceWorkerUpdate()
  usePushResubscribe()

  const isCompactLayout = useRouterState({
    select: (state) =>
      state.matches.some(
        (match) =>
          (match.routeId === '/' || match.routeId === '/memo') &&
          isCompactDayLayoutSearch(match.search),
      ),
  })

  if (isCompactLayout) {
    return (
      <CompactLayoutFrame>
        <Outlet />
      </CompactLayoutFrame>
    )
  }

  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  )
}
