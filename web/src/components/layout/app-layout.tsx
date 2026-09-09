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
    <div
      className={cn(
        // `sticky`, not `fixed`: stays in normal document flow (document
        // scrolling still works) while still stopping prosemirror-view's
        // cursor scroll-into-view walk from reaching document.body and
        // scrolling it directly.
        'sticky flex',
        insets === null
          ? cn(
              'top-0',
              // Exact height only caps this box, not document scroll (it
              // stays `overflow-visible`) — except on day view, which needs
              // the opposite: an exact `h-dvh` so its `h-full`/`min-h-0`
              // chain (below) stays bounded instead of a `min-h-dvh` floor.
              isDayView ? 'h-dvh' : 'min-h-dvh',
            )
          : 'inset-x-0',
      )}
      // top/height from insets, not the static `top-0` above: iOS Safari's
      // software keyboard shrinks the visual viewport but not the layout
      // viewport, so a static `top-0` would sit behind the keyboard.
      style={
        insets === null ? undefined : { top: insets.top, height: insets.height }
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
