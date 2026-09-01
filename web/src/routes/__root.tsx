import { createRootRoute, Outlet } from '@tanstack/react-router'

import { AppLayout } from '#components/layout/app-layout'
import { useGithubSync } from '#hooks/use-github-link'

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  useGithubSync()

  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  )
}
