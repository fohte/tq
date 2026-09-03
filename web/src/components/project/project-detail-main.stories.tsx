import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ParsedQuery } from 'api/search-query-parser'
import type { ReactNode } from 'react'

import { ProjectMainContent } from '#components/project/project-detail-main'
import {
  ProjectSidebar,
  ProjectSidebarMobile,
} from '#components/project/project-detail-sidebar'
import { makeProjectDetail } from '#components/project/project-test-fixtures'
import { makeTask } from '#components/task/task-row-test-fixtures'
import type { Project, ProjectDetail, ProjectTask } from '#hooks/use-projects'
import { projectKeys } from '#hooks/use-projects'
import { buildTree } from '#lib/tree-builder'
import { StoryRouter } from '#storybook-config/story-router'

const baseProject = makeProjectDetail({
  id: 'proj-001',
  title: 'ISUCON14',
  description:
    '## Goal\n\nOptimize the ISUCON14 practice benchmark.\n\n- Provision servers\n- Tune database config',
  startDate: '2026-06-01',
  targetDate: '2026-08-15',
  color: '#FF8400',
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
  completionRate: 0.4,
  taskCount: { total: 5, completed: 2 },
})

function makeProjectTask(overrides: Partial<ProjectTask> = {}): ProjectTask {
  return makeTask({
    projectId: 'proj-001',
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  })
}

const sampleTasks: ProjectTask[] = [
  makeProjectTask({
    id: '1',
    number: 1,
    title: 'Provision benchmark servers',
    status: 'completed',
  }),
  makeProjectTask({
    id: '2',
    number: 2,
    title: 'Tune MySQL config',
    status: 'completed',
  }),
  makeProjectTask({
    id: '3',
    number: 3,
    title: 'Profile slow queries',
  }),
  makeProjectTask({
    id: '4',
    number: 4,
    title: 'Add caching layer',
  }),
  makeProjectTask({
    id: '5',
    number: 5,
    title: 'Write final report',
  }),
]

const sampleProjects: Project[] = [baseProject]

const defaultParsedQuery: ParsedQuery = {
  freeText: '',
  status: ['todo'],
  sortBy: 'updated',
}

function Providers({
  project,
  children,
}: {
  project: ProjectDetail
  children: ReactNode
}) {
  const queryClient = new QueryClient({
    // staleTime: Infinity keeps the seeded data below from being treated as
    // stale and refetched on mount (the app's real QueryClient uses a
    // shorter staleTime, but relies on the seed being fresh from a fetch
    // moments earlier — this story has no server to refetch from).
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  // Mirrors the real /projects/$projectId route, which already calls
  // useProject(projectId) before ProjectMainContent renders its task rows —
  // without this, TaskProjectLabel's useProject(task.projectId) would fire
  // an unmocked fetch.
  queryClient.setQueryData(projectKeys.detail(project.id), project)
  return (
    <QueryClientProvider client={queryClient}>
      <StoryRouter
        component={() => <>{children}</>}
        paths={['/projects', '/tasks/$taskId']}
      />
    </QueryClientProvider>
  )
}

// --- ProjectMainContent Stories ---

function MainContentStory({
  project,
  tasks,
}: {
  project: ProjectDetail
  tasks: ProjectTask[]
}) {
  return (
    <Providers project={project}>
      <div className="max-w-2xl p-6">
        <ProjectMainContent
          project={project}
          parsedQuery={defaultParsedQuery}
          onQueryChange={() => {}}
          projects={sampleProjects}
          tree={buildTree(tasks)}
          filteredTasks={tasks}
          isTasksLoading={false}
          lazyChildrenFilter={undefined}
          sessionsByTaskId={new Map()}
          hasNextPage={false}
          isFetchingNextPage={false}
          isFetchNextPageError={false}
          fetchNextPage={() => {}}
        />
      </div>
    </Providers>
  )
}

const mainContentMeta = {
  title: 'Project/ProjectDetail/MainContent',
  component: MainContentStory,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof MainContentStory>

export default mainContentMeta
type Story = StoryObj<typeof mainContentMeta>

export const Default: Story = {
  args: {
    project: { ...baseProject },
    tasks: sampleTasks,
  },
}

export const NoDescription: Story = {
  args: {
    project: { ...baseProject, description: null },
    tasks: sampleTasks,
  },
}

export const NoTasks: Story = {
  args: {
    project: {
      ...baseProject,
      completionRate: 0,
      taskCount: { total: 0, completed: 0 },
    },
    tasks: [],
  },
}

export const Completed: Story = {
  args: {
    project: {
      ...baseProject,
      status: 'completed',
      completionRate: 1,
      taskCount: { total: 5, completed: 5 },
    },
    tasks: sampleTasks.map((task) => ({ ...task, status: 'completed' })),
  },
}

// --- Full Page Layout ---

export const FullPagePC: StoryObj<{
  project: ProjectDetail
  tasks: ProjectTask[]
}> = {
  args: {
    project: { ...baseProject },
    tasks: sampleTasks,
  },
  tags: ['desktop-only'],
  parameters: {
    layout: 'fullscreen',
  },
  render: ({ project, tasks }) => (
    <Providers project={project}>
      <div className="flex">
        <div className="flex-1 p-6">
          <ProjectMainContent
            project={project}
            parsedQuery={defaultParsedQuery}
            onQueryChange={() => {}}
            projects={sampleProjects}
            tree={buildTree(tasks)}
            filteredTasks={tasks}
            isTasksLoading={false}
            lazyChildrenFilter={undefined}
            sessionsByTaskId={new Map()}
            hasNextPage={false}
            isFetchingNextPage={false}
            isFetchNextPageError={false}
            fetchNextPage={() => {}}
          />
        </div>
        <ProjectSidebar project={project} />
      </div>
    </Providers>
  ),
}

export const FullPageSP: StoryObj<{
  project: ProjectDetail
  tasks: ProjectTask[]
}> = {
  args: {
    project: { ...baseProject },
    tasks: sampleTasks,
  },
  parameters: {
    layout: 'fullscreen',
    viewport: { defaultViewport: 'mobile1' },
  },
  render: ({ project, tasks }) => (
    <Providers project={project}>
      <div className="flex flex-col">
        <div className="p-4">
          <ProjectMainContent
            project={project}
            parsedQuery={defaultParsedQuery}
            onQueryChange={() => {}}
            projects={sampleProjects}
            tree={buildTree(tasks)}
            filteredTasks={tasks}
            isTasksLoading={false}
            lazyChildrenFilter={undefined}
            sessionsByTaskId={new Map()}
            hasNextPage={false}
            isFetchingNextPage={false}
            isFetchNextPageError={false}
            fetchNextPage={() => {}}
          />
        </div>
        <div className="border-t border-border p-4">
          <ProjectSidebarMobile project={project} />
        </div>
      </div>
    </Providers>
  ),
}
