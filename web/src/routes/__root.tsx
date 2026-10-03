import { createRootRoute, Outlet, useRouterState } from '@tanstack/react-router'

import { AppLayout } from '#components/layout/app-layout'
import { useGithubSync } from '#hooks/use-github-link'
import { usePushResubscribe } from '#hooks/use-push-notifications'
import { useServiceWorkerUpdate } from '#hooks/use-service-worker-update'

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  useGithubSync()
  useServiceWorkerUpdate()
  usePushResubscribe()

  const isCompactLayout = useRouterState({
    select: (state) =>
      state.location.pathname === '/' &&
      state.location.search.layout === 'compact',
  })

  if (isCompactLayout) {
    return (
      <div className="h-dvh w-full overflow-hidden">
        <Outlet />
      </div>
    )
  }

  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  )
}
