import { useRouterState } from '@tanstack/react-router'
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

  // Viewport-pinned routes (day view "/" and the task page editor) size
  // their content with h-full off of <main>'s flex-allotted height instead
  // of scrolling the document. Every other route relies on <main>'s content
  // being free to grow past that allotment (flexbox's automatic minimum
  // size), which is what makes the *document* scroll — so min-h-0 can't
  // apply unconditionally without breaking that for every other route.
  const isViewportPinned = useRouterState({
    select: (state) =>
      state.location.pathname === '/' ||
      /^\/tasks\/[^/]+\/pages\/[^/]+$/.test(state.location.pathname),
  })

  return (
    <div
      className={cn(
        // Stops prosemirror-view's cursor scroll-into-view walk from
        // reaching document.body, while keeping normal document flow.
        'sticky flex',
        insets === null
          ? cn('top-0', isViewportPinned ? 'h-dvh' : 'min-h-dvh')
          : 'inset-x-0',
      )}
      style={
        insets === null ? undefined : { top: insets.top, height: insets.height }
      }
    >
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className={cn('flex-1', isViewportPinned && 'min-h-0')}>
          {children}
        </main>
        <StatusLine />
        <BottomTabBar />
      </div>
      <SearchModal open={searchOpen} onOpenChange={setSearchOpen} />
      <CreateTaskModal open={newTaskOpen} onOpenChange={setNewTaskOpen} />
    </div>
  )
}
