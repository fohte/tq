import { createRootRoute, Outlet } from '@tanstack/react-router'

import { AppLayout } from '#components/layout/app-layout'
import { useGithubSync } from '#hooks/use-github-link'
import { usePushResubscribe } from '#hooks/use-push-notifications'

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  useGithubSync()
  usePushResubscribe()

  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  )
}
