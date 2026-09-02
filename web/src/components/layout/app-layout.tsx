import { type ReactNode, useCallback, useState } from 'react'

import { BottomTabBar } from '#components/layout/bottom-tab-bar'
import { Sidebar } from '#components/layout/sidebar'
import { StatusLine } from '#components/layout/status-line'
import { SearchModal } from '#components/search/search-modal'
import { CreateTaskModal } from '#components/task/create-task-modal'
import { useGlobalKeybindings } from '#hooks/use-global-keybindings'

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

  return (
    // `fixed inset-0` (not `h-screen`/100vh, which mobile browsers don't
    // shrink for an open on-screen keyboard): prosemirror-view's cursor
    // scroll-into-view walk stops at the first `fixed`/`sticky` ancestor
    // (prosemirror-view's scrollRectIntoView), so pinning the root here
    // keeps it from ever reaching document.body and calling
    // window.scrollBy on every keystroke.
    <div className="fixed inset-0 flex">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 overflow-auto">{children}</main>
        <StatusLine />
        <BottomTabBar />
      </div>
      <SearchModal open={searchOpen} onOpenChange={setSearchOpen} />
      <CreateTaskModal open={newTaskOpen} onOpenChange={setNewTaskOpen} />
    </div>
  )
}
