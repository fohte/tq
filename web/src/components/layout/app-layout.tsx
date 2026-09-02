import { useRouterState } from '@tanstack/react-router'
import { type ReactNode, useCallback, useState } from 'react'

import { BottomTabBar } from '#components/layout/bottom-tab-bar'
import { Sidebar } from '#components/layout/sidebar'
import { StatusLine } from '#components/layout/status-line'
import { SearchModal } from '#components/search/search-modal'
import { CreateTaskModal } from '#components/task/create-task-modal'
import { useGlobalKeybindings } from '#hooks/use-global-keybindings'
import { cn } from '#lib/utils'

export function AppLayout({ children }: { children: ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [newTaskOpen, setNewTaskOpen] = useState(false)

  useGlobalKeybindings({
    searchOpen,
    onSearchOpenChange: setSearchOpen,
    onNewTask: useCallback(() => {
      setNewTaskOpen(true)
    }, []),
  })

  // Day view (route "/") pins its content to one viewport instead of
  // scrolling the document, and sizes itself with h-full off of <main>'s
  // flex-allotted height. Every other route relies on <main>'s content
  // being free to grow past that allotment (flexbox's automatic minimum
  // size), which is what makes the *document* scroll — so min-h-0 can't
  // apply unconditionally without breaking that for every other route.
  const isDayView = useRouterState({
    select: (state) => state.location.pathname === '/',
  })

  return (
    // prosemirror-view's cursor scroll-into-view walk stops at the first
    // sticky or fixed ancestor, keeping it from calling window.scrollBy on
    // document.body on every keystroke.
    <div className="sticky top-0 flex min-h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className={cn('flex-1', isDayView && 'min-h-0')}>{children}</main>
        <StatusLine />
        <BottomTabBar />
      </div>
      <SearchModal open={searchOpen} onOpenChange={setSearchOpen} />
      <CreateTaskModal open={newTaskOpen} onOpenChange={setNewTaskOpen} />
    </div>
  )
}
