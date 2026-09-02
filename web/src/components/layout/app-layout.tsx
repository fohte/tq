import { type ReactNode, useCallback, useState } from 'react'

import { BottomTabBar } from '#components/layout/bottom-tab-bar'
import { Sidebar } from '#components/layout/sidebar'
import { StatusLine } from '#components/layout/status-line'
import { SearchModal } from '#components/search/search-modal'
import { CreateTaskModal } from '#components/task/create-task-modal'
import { useGlobalKeybindings } from '#hooks/use-global-keybindings'
import { useVisualViewportInsets } from '#hooks/use-visual-viewport-insets'
import { cn } from '#lib/utils'

export function AppLayout({ children }: { children: ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [newTaskOpen, setNewTaskOpen] = useState(false)
  const insets = useVisualViewportInsets()

  useGlobalKeybindings({
    searchOpen,
    onSearchOpenChange: setSearchOpen,
    onNewTask: useCallback(() => {
      setNewTaskOpen(true)
    }, []),
  })

  return (
    // `fixed`: prosemirror-view's cursor scroll-into-view walk stops at the
    // first fixed/sticky ancestor, so this keeps it from reaching
    // document.body and calling window.scrollBy on every keystroke.
    // top/height track the visual viewport instead of a plain `inset-0`:
    // iOS Safari's software keyboard shrinks the visual viewport but not the
    // layout viewport, so `inset-0` would leave this box (and the descendant
    // scroll containers that stop the cursor scroll-into-view walk) extending
    // behind the keyboard, making that walk think the cursor is still visible.
    <div
      className={cn('fixed inset-x-0 flex', insets === null && 'inset-y-0')}
      style={
        insets === null ? undefined : { top: insets.top, height: insets.height }
      }
    >
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
