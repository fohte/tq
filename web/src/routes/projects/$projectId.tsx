import { createFileRoute, stripSearchParams } from '@tanstack/react-router'
import { buildSearchQuery, parseSearchQuery } from 'api/search-query-parser'

import {
  ProjectMainContent,
  ProjectSidebar,
  ProjectSidebarMobile,
} from '#components/project/project-detail'
import { BackHeaderBar } from '#components/ui/back-header-bar'
import { FullPageLoading } from '#components/ui/full-page-loading'
import { FullPageMessage } from '#components/ui/full-page-message'
import { useFilteredTaskTree } from '#hooks/use-filtered-tasks'
import { useProject, useProjects } from '#hooks/use-projects'
import { useTaskAgentSessionsByTaskId } from '#hooks/use-task-agent-sessions'

const projectTasksSearchDefaults = {
  q: buildSearchQuery({
    freeText: '',
    status: ['todo'],
    sortBy: 'updated',
  }),
}

interface ProjectDetailSearch {
  q?: string
}

function validateSearch(search: Record<string, unknown>): ProjectDetailSearch {
  const rawQ = typeof search['q'] === 'string' ? search['q'] : undefined
  return rawQ != null && rawQ !== ''
    ? { q: rawQ }
    : { q: projectTasksSearchDefaults.q }
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
  const { q = projectTasksSearchDefaults.q } = Route.useSearch()
  const navigate = Route.useNavigate()
  const {
    data: project,
    isLoading: isProjectLoading,
    error,
  } = useProject(projectId)
  const projects = useProjects()

  const setQuery = (newQuery: string) => {
    void navigate({
      search: (prev) => ({ ...prev, q: newQuery }),
      replace: true,
    })
  }

  const parsedQuery = parseSearchQuery(q)
  const {
    isLoading: isFilteredTasksLoading,
    tree,
    tasks: filteredTasks,
    lazyChildrenFilter,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    fetchNextPage,
  } = useFilteredTaskTree({ q, projectId })
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
      <div className="hidden h-full md:flex">
        <div
          className="flex-1 overflow-y-auto p-6"
          data-scroll-restoration-id="project-detail"
        >
          <ProjectMainContent
            key={project.id}
            project={project}
            parsedQuery={parsedQuery}
            onQueryChange={setQuery}
            projects={projects.data ?? []}
            tree={tree}
            filteredTasks={filteredTasks}
            isTasksLoading={isFilteredTasksLoading}
            lazyChildrenFilter={lazyChildrenFilter}
            sessionsByTaskId={sessionsByTaskId}
            ancestorScrollRestorationId="project-detail"
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            isFetchNextPageError={isFetchNextPageError}
            fetchNextPage={fetchNextPage}
          />
        </div>
        <ProjectSidebar key={project.id} project={project} />
      </div>

      {/* SP layout */}
      <div
        className="flex h-full flex-col overflow-y-auto md:hidden"
        data-scroll-restoration-id="project-detail-mobile"
      >
        <BackHeaderBar to="/projects">Projects</BackHeaderBar>
        <div className="p-4">
          <ProjectMainContent
            key={project.id}
            project={project}
            parsedQuery={parsedQuery}
            onQueryChange={setQuery}
            projects={projects.data ?? []}
            tree={tree}
            filteredTasks={filteredTasks}
            isTasksLoading={isFilteredTasksLoading}
            lazyChildrenFilter={lazyChildrenFilter}
            sessionsByTaskId={sessionsByTaskId}
            ancestorScrollRestorationId="project-detail-mobile"
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            isFetchNextPageError={isFetchNextPageError}
            fetchNextPage={fetchNextPage}
          />
        </div>
        <div className="border-t border-border p-4">
          <ProjectSidebarMobile key={project.id} project={project} />
        </div>
      </div>
    </>
  )
}
