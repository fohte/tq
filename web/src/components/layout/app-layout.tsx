import { useMatchRoute } from '@tanstack/react-router'
import { type ReactNode, useCallback, useState } from 'react'

import { BottomTabBar } from '#components/layout/bottom-tab-bar'
import { Sidebar } from '#components/layout/sidebar'
import { StatusLine } from '#components/layout/status-line'
import { UrlCopiedToast } from '#components/layout/url-copied-toast'
import { SearchModal } from '#components/search/search-modal'
import { CreateTaskModal } from '#components/task/create-task-modal'
import { useGlobalKeybindings } from '#hooks/use-global-keybindings'
import { useSearchModalDefaultQuery } from '#hooks/use-search-modal-default-query'
import { SearchModalOpenContext } from '#hooks/use-search-modal-open'
import { useUrlCopiedToast } from '#hooks/use-url-copied-toast'
import { useVisualViewportInsets } from '#hooks/use-visual-viewport-insets'
import { cn } from '#lib/utils'

interface VisualViewportStyle extends React.CSSProperties {
  '--visual-viewport-top': string
  '--visual-viewport-height': string
}

export function AppLayout({ children }: { children: ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [newTaskOpen, setNewTaskOpen] = useState(false)
  const copiedUrl = useUrlCopiedToast()
  const defaultSearchQuery = useSearchModalDefaultQuery()
  const openNewTask = useCallback(() => {
    setNewTaskOpen(true)
  }, [])
  const insets = useVisualViewportInsets()

  useGlobalKeybindings({
    searchOpen,
    onSearchOpenChange: setSearchOpen,
    onNewTask: openNewTask,
  })

  // Viewport-pinned routes need min-h-0 so their h-full content resolves
  // against <main>'s flex-allotted height; other routes rely on the default
  // min-height: auto to let the *document* scroll instead.
  const matchRoute = useMatchRoute()
  const isViewportPinned =
    matchRoute({ to: '/', fuzzy: false }) !== false ||
    matchRoute({ to: '/tasks/$taskId/pages/$pageId', fuzzy: false }) !== false

  return (
    <div
      className={cn(
        // Stops prosemirror-view's cursor scroll-into-view walk from
        // reaching document.body, while keeping normal document flow.
        'sticky flex',
        insets === null
          ? cn('top-0', isViewportPinned ? 'h-dvh' : 'min-h-dvh')
          : 'inset-x-0 top-(--visual-viewport-top) h-(--visual-viewport-height)',
      )}
      style={
        insets === null
          ? undefined
          : ({
              '--visual-viewport-top': `${String(insets.top)}px`,
              '--visual-viewport-height': `${String(insets.height)}px`,
            } as VisualViewportStyle)
      }
    >
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className={cn('flex-1', isViewportPinned && 'min-h-0')}>
          <SearchModalOpenContext.Provider value={searchOpen}>
            {children}
          </SearchModalOpenContext.Provider>
        </main>
        <StatusLine />
        <BottomTabBar />
      </div>
      <SearchModal
        open={searchOpen}
        onOpenChange={setSearchOpen}
        defaultQuery={defaultSearchQuery}
        onNewTask={openNewTask}
      />
      <CreateTaskModal open={newTaskOpen} onOpenChange={setNewTaskOpen} />
      <UrlCopiedToast url={copiedUrl} />
    </div>
  )
}
