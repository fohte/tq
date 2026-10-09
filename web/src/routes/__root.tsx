import {
  createRootRoute,
  Outlet,
  useBlocker,
  useRouter,
  useRouterState,
} from '@tanstack/react-router'
import { useEffect } from 'react'

import { AppLayout } from '#components/layout/app-layout'
import { CompactLayoutFrame } from '#components/layout/compact-layout-frame'
import { usePushResubscribe } from '#hooks/use-push-notifications'
import { useServiceWorkerUpdate } from '#hooks/use-service-worker-update'
import { isCompactDayLayoutMatch } from '#lib/compact-layout'
import { getTqDesktopApi } from '#lib/tq-desktop'

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  const router = useRouter()

  useBlocker({
    shouldBlockFn: ({ current, next }) => {
      if (
        current.pathname === next.pathname ||
        !isCompactDayLayoutMatch(current.routeId, current.search)
      ) {
        return false
      }

      const desktop = getTqDesktopApi()
      if (desktop == null) return false

      desktop.openInMainWindow(
        `${next.pathname}${router.options.stringifySearch(next.search)}`,
      )
      return true
    },
    enableBeforeUnload: false,
    withResolver: false,
  })

  useServiceWorkerUpdate()
  usePushResubscribe()

  const isCompactLayout = useRouterState({
    select: (state) =>
      state.matches.some((match) =>
        isCompactDayLayoutMatch(match.routeId, match.search),
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
