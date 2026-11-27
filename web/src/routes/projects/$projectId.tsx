import { createFileRoute, stripSearchParams } from '@tanstack/react-router'
import { buildSearchQuery, parseSearchQuery } from 'api/search-query-parser'
import { useEffect } from 'react'

import {
  ProjectMainContent,
  ProjectSidebar,
  ProjectSidebarMobile,
} from '#components/project/project-detail'
import { BackHeaderBar } from '#components/ui/back-header-bar'
import { FullPageLoading } from '#components/ui/full-page-loading'
import { FullPageMessage } from '#components/ui/full-page-message'
import { useFilteredTaskTree } from '#hooks/use-filtered-tasks'
import { useProjectFields } from '#hooks/use-project-fields'
import { useProject } from '#hooks/use-projects'
import { useTaskAgentSessionsByTaskId } from '#hooks/use-task-agent-sessions'
import { recordRecentSearchItem } from '#lib/recent-search-items'
import { tasksSearchDefaultQuery, withDefaultSort } from '#lib/tasks-query'

const projectTasksSearchDefaults = {
  q: tasksSearchDefaultQuery,
}

interface ProjectDetailSearch {
  q?: string
  groupBy?: string
}

function validateSearch(search: Record<string, unknown>): ProjectDetailSearch {
  const rawQ = typeof search['q'] === 'string' ? search['q'] : undefined
  const groupBy =
    typeof search['groupBy'] === 'string' ? search['groupBy'] : undefined
  return {
    q: rawQ == null || rawQ === '' ? projectTasksSearchDefaults.q : rawQ,
    ...(groupBy == null ? {} : { groupBy }),
  }
}

export const Route = createFileRoute('/projects/$projectId')({
  validateSearch,
  search: {
    middlewares: [stripSearchParams(projectTasksSearchDefaults)],
  },
  component: ProjectDetailPage,
})

function ProjectDetailPage() {
  const { projectId } = Route.useParams()
  const { q = projectTasksSearchDefaults.q, groupBy } = Route.useSearch()
  const navigate = Route.useNavigate()
  const {
    data: project,
    isLoading: isProjectLoading,
    error,
  } = useProject(projectId)
  const projectFieldsQuery = useProjectFields(projectId, {
    enabled: project != null,
  })
  const projectFields = projectFieldsQuery.data ?? []
  const groupByField = projectFieldsQuery.data?.find(
    (field) => field.id === groupBy,
  )
  const groupByResolved =
    groupBy == null ||
    projectFieldsQuery.data != null ||
    projectFieldsQuery.isError

  useEffect(() => {
    if (isProjectLoading || error || project == null) return
    recordRecentSearchItem({
      kind: 'project',
      id: project.id,
      title: project.title,
      context: project.context,
    })
  }, [error, isProjectLoading, project?.context, project?.id, project?.title])

  const setQuery = (newQuery: string) => {
    void navigate({
      search: (prev) => ({ ...prev, q: newQuery }),
      replace: true,
    })
  }

  const setGroupBy = (fieldId: string | undefined) => {
    void navigate({
      search: (prev) => {
        if (fieldId == null) {
          const next = { ...prev }
          delete next.groupBy
          return next
        }
        return { ...prev, groupBy: fieldId }
      },
      replace: true,
    })
  }

  const parsedQuery = parseSearchQuery(q)
  const filteredQuery = buildSearchQuery(withDefaultSort(parsedQuery))
  const {
    isLoading: isFilteredTasksLoading,
    tree,
    tasks: filteredTasks,
    lazyChildrenFilter,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    fetchNextPage,
  } = useFilteredTaskTree({
    q: filteredQuery,
    projectId,
    enabled: groupByResolved && groupByField == null,
  })
  const isProjectTaskListLoading =
    isFilteredTasksLoading || (groupBy != null && !groupByResolved)
  const sessionsByTaskId = useTaskAgentSessionsByTaskId().data ?? new Map()

  const isLoading = isProjectLoading

  if (isLoading) {
    return <FullPageLoading />
  }

  if (error || !project) {
    return <FullPageMessage>Project not found</FullPageMessage>
  }

  return (
    <>
      {/* PC layout */}
      <div className="hidden md:flex">
        <div className="flex-1 p-6">
          <ProjectMainContent
            key={project.id}
            project={project}
            parsedQuery={parsedQuery}
            onQueryChange={setQuery}
            tree={tree}
            filteredTasks={filteredTasks}
            isTasksLoading={isProjectTaskListLoading}
            lazyChildrenFilter={lazyChildrenFilter}
            sessionsByTaskId={sessionsByTaskId}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            isFetchNextPageError={isFetchNextPageError}
            fetchNextPage={fetchNextPage}
            projectFields={projectFields}
            groupByField={groupByField}
            onGroupByChange={setGroupBy}
            hasProjectFieldsError={projectFieldsQuery.isError}
            onProjectFieldsRetry={() => void projectFieldsQuery.refetch()}
          />
        </div>
        <ProjectSidebar key={project.id} project={project} />
      </div>

      {/* SP layout */}
      <div className="flex flex-col md:hidden">
        <div className="sticky top-0 z-10">
          <BackHeaderBar to="/projects">Projects</BackHeaderBar>
        </div>
        <div className="p-4">
          <ProjectMainContent
            key={project.id}
            project={project}
            parsedQuery={parsedQuery}
            onQueryChange={setQuery}
            tree={tree}
            filteredTasks={filteredTasks}
            isTasksLoading={isProjectTaskListLoading}
            lazyChildrenFilter={lazyChildrenFilter}
            sessionsByTaskId={sessionsByTaskId}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            isFetchNextPageError={isFetchNextPageError}
            fetchNextPage={fetchNextPage}
            projectFields={projectFields}
            groupByField={groupByField}
            onGroupByChange={setGroupBy}
            hasProjectFieldsError={projectFieldsQuery.isError}
            onProjectFieldsRetry={() => void projectFieldsQuery.refetch()}
          />
        </div>
        <div className="border-t border-border p-4">
          <ProjectSidebarMobile key={project.id} project={project} />
        </div>
      </div>
    </>
  )
}
