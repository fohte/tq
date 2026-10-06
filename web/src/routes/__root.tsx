import {
  createRootRoute,
  Outlet,
  useRouter,
  useRouterState,
} from '@tanstack/react-router'
import { useEffect } from 'react'

import { AppLayout } from '#components/layout/app-layout'
import { CompactLayoutFrame } from '#components/layout/compact-layout-frame'
import { useGithubSync } from '#hooks/use-github-link'
import { usePushResubscribe } from '#hooks/use-push-notifications'
import { useServiceWorkerUpdate } from '#hooks/use-service-worker-update'
import { isCompactDayLayoutSearch } from '#lib/compact-layout'
import { getTqDesktopApi } from '#lib/tq-desktop'

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  const router = useRouter()

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

  useEffect(() => {
    if (isCompactLayout) return

    return getTqDesktopApi()?.onNavigateRequest((path) => {
      void router.navigate({ href: path })
    })
  }, [isCompactLayout, router])

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
