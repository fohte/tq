import { type ReactNode, useState } from 'react'

import { BottomTabBar } from '#components/layout/bottom-tab-bar'
import { Sidebar } from '#components/layout/sidebar'
import { StatusLine } from '#components/layout/status-line'
import { SearchModal } from '#components/search/search-modal'
import { useGlobalKeybindings } from '#hooks/use-global-keybindings'

export function AppLayout({ children }: { children: ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false)

  useGlobalKeybindings({ searchOpen, onSearchOpenChange: setSearchOpen })

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 overflow-auto pb-[52px] md:pb-0">
          {children}
        </main>
        <StatusLine />
      </div>
      <BottomTabBar />
      <SearchModal open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  )
}
