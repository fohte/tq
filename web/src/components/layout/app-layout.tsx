import { BottomTabBar } from '@web/components/layout/bottom-tab-bar'
import { Sidebar } from '@web/components/layout/sidebar'
import type { ReactNode } from 'react'

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto pb-14 md:pb-0">{children}</main>
      <BottomTabBar />
    </div>
  )
}
