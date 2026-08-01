import { type ReactNode, useCallback, useEffect, useState } from 'react'

import { BottomTabBar } from '#components/layout/bottom-tab-bar'
import { Sidebar } from '#components/layout/sidebar'
import { StatusLine } from '#components/layout/status-line'
import { SearchModal } from '#components/search/search-modal'

export function AppLayout({ children }: { children: ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false)

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      setSearchOpen((prev) => !prev)
    }
  }, [])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])

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
