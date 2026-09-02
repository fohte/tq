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
    // `sticky`, not `fixed`: prosemirror-view's cursor scroll-into-view walk
    // stops at the first fixed/sticky ancestor, so this keeps it from
    // reaching document.body and calling window.scrollBy on every keystroke
    // — but unlike `fixed`, it stays in normal document flow, which document
    // scrolling depends on.
    // min-height, not height: iOS Safari's software keyboard shrinks the
    // visual viewport but not the layout viewport, so a static `top-0` would
    // leave this box (and the descendant scroll containers that stop the
    // cursor scroll-into-view walk) extending behind the keyboard, making
    // that walk think the cursor is still visible — tracking insets.top
    // keeps its stuck position aligned with the visible area. But content
    // taller than one viewport must still be free to push this box (and so
    // the document) taller, which an exact `height` would cap.
    <div
      className={cn(
        'sticky flex',
        insets === null ? 'top-0 min-h-dvh' : 'inset-x-0',
      )}
      style={
        insets === null
          ? undefined
          : { top: insets.top, minHeight: insets.height }
      }
    >
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
