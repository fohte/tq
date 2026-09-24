import { useNavigate } from '@tanstack/react-router'
import { useCallback, useRef } from 'react'

import type { SavedView } from '#hooks/use-saved-views'
import type { PageSearchResult, SearchResult } from '#hooks/use-search'
import type { NavKeybinding } from '#lib/keybindings'

export function useSearchModalNavigation(onOpenChangeRef: {
  current: (open: boolean) => void
}) {
  const navigate = useNavigate()
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate

  const openTask = useCallback((task: Pick<SearchResult, 'id'>) => {
    onOpenChangeRef.current(false)
    void navigateRef.current({
      to: '/tasks/$taskId',
      params: { taskId: task.id },
    })
  }, [])

  const openProject = useCallback((project: { id: string }) => {
    onOpenChangeRef.current(false)
    void navigateRef.current({
      to: '/projects/$projectId',
      params: { projectId: project.id },
    })
  }, [])

  const openRoute = useCallback((to: NavKeybinding['to']) => {
    onOpenChangeRef.current(false)
    void navigateRef.current({ to })
  }, [])

  const openView = useCallback((view: SavedView) => {
    onOpenChangeRef.current(false)
    void navigateRef.current({
      to: '/tasks',
      search: { q: view.query },
    })
  }, [])

  const openPage = useCallback((page: PageSearchResult) => {
    if (page.pageId == null) return
    onOpenChangeRef.current(false)
    void navigateRef.current({
      to: '/tasks/$taskId/pages/$pageId',
      params: {
        taskId: String(page.taskNumber),
        pageId: page.pageId,
      },
    })
  }, [])

  return { openTask, openProject, openView, openPage, openRoute }
}
