import { useNavigate } from '@tanstack/react-router'
import { useCallback, useRef } from 'react'

import type { Project } from '#hooks/use-projects'
import type { SavedView } from '#hooks/use-saved-views'
import type { PageSearchResult, SearchResult } from '#hooks/use-search'

export function useSearchModalNavigation(onOpenChangeRef: {
  current: (open: boolean) => void
}) {
  const navigate = useNavigate()
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate

  const openTask = useCallback((task: SearchResult) => {
    onOpenChangeRef.current(false)
    void navigateRef.current({
      to: '/tasks/$taskId',
      params: { taskId: task.id },
    })
  }, [])

  const openProject = useCallback((project: Project) => {
    onOpenChangeRef.current(false)
    void navigateRef.current({
      to: '/projects/$projectId',
      params: { projectId: project.id },
    })
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

  return { openTask, openProject, openView, openPage }
}
