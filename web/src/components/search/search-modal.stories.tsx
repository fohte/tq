import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { useState } from 'react'

import { makeSavedView } from '#components/layout/sidebar-test-fixtures'
import { makeProject } from '#components/project/project-test-fixtures'
import { SearchModal } from '#components/search/search-modal'
import {
  makePageSearchResult,
  makeRecentProject,
  makeRecentTask,
  makeSuggestion,
} from '#components/search/search-test-fixtures'
import {
  makeTask,
  makeTaskDetail,
} from '#components/task/task-row-test-fixtures'
import type { RecentSearchItem } from '#lib/recent-search-items'
import { StoryRouter } from '#storybook-config/story-router'

const keyboardQuery = 'keyboard'
const workbenchQuery = 'workbench'
const scrollableQuery = 'scrollable'

const searchTask = makeTask({
  id: '00000000-0000-0000-0000-000000000042',
  number: 42,
  title: 'Keyboard shortcuts',
  context: 'work',
})
const searchTaskDetail = makeTaskDetail({
  id: searchTask.id,
  number: searchTask.number,
  title: searchTask.title,
  context: 'work',
})
const scrollableTasks = Array.from({ length: 16 }, (_, index) => {
  const resultNumber = index + 1
  const resultLabel = String(resultNumber)
  return makeTask({
    id: `scrollable-task-${resultLabel}`,
    number: resultNumber + 100,
    title: `Scrollable result ${resultLabel}`,
    context: 'work',
  })
})

const searchProject = makeProject({
  id: '00000000-0000-0000-0000-000000000142',
  title: 'Keyboard navigation',
  context: 'work',
})
const projectScopeQuery = `project:${searchProject.id} `
const projectScopedTask = makeTask({
  id: '00000000-0000-0000-0000-000000000143',
  number: 143,
  title: 'Project scoped task',
  context: 'work',
  projectId: searchProject.id,
})
const taskScopeQuery = `parent:${searchTask.id} `
const taskScopedTask = makeTask({
  id: '00000000-0000-0000-0000-000000000043',
  number: 43,
  title: 'Child task',
  context: 'work',
  parentId: searchTask.id,
})

const searchView = makeSavedView({
  id: '00000000-0000-0000-0000-000000000242',
  name: 'Keyboard view',
  context: 'work',
})

const isolatedView = makeSavedView({
  id: '00000000-0000-0000-0000-000000000243',
  name: 'Workbench',
  context: 'work',
})

const numberedTask = makeTaskDetail({
  id: '00000000-0000-0000-0000-000000000312',
  number: 312,
  title: 'Search modal keyboard shortcuts',
  context: 'work',
})
const numberedTaskNumber = String(numberedTask.number)
const numberedTaskQuery = `#${numberedTaskNumber}`

const suggestions = [
  makeSuggestion(),
  makeSuggestion({ value: 'is:completed', display: 'Completed' }),
]

const searchPage = makePageSearchResult({
  taskNumber: searchTask.number,
  taskTitle: searchTask.title,
  pageId: 'keyboard-shortcuts',
  pageTitle: 'Keyboard shortcuts',
  snippet: 'Keyboard shortcuts for searching and navigation.',
})
const recentItems: RecentSearchItem[] = [
  makeRecentTask({
    id: searchTask.id,
    number: searchTask.number,
    title: searchTask.title,
    viewedAt: 1_800_000_000_000,
  }),
  makeRecentProject({
    id: searchProject.id,
    title: searchProject.title,
    viewedAt: 1_799_999_000_000,
  }),
]

function Providers({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>
      <StoryRouter
        component={() => <>{children}</>}
        paths={[
          '/tasks/$taskId',
          '/tasks/$taskId/pages/$pageId',
          '/projects/$projectId',
        ]}
      />
    </QueryClientProvider>
  )
}

function SearchModalStory({
  defaultContext,
  defaultQuery,
  defaultHelpOpen,
  defaultRecentItems,
}: {
  defaultContext?: 'work' | 'personal' | null
  defaultQuery?: string
  defaultHelpOpen?: boolean
  defaultRecentItems?: RecentSearchItem[]
} = {}) {
  const [open, setOpen] = useState(true)
  return (
    <Providers>
      <div className="flex h-screen items-center justify-center bg-background">
        <button
          type="button"
          onClick={() => {
            setOpen(true)
          }}
          className="border border-border bg-secondary px-4 py-2 font-mono text-sm text-foreground"
        >
          Open Search (Cmd+K)
        </button>
        <SearchModal
          open={open}
          onOpenChange={setOpen}
          onNewTask={() => undefined}
          {...(defaultContext === undefined ? {} : { defaultContext })}
          {...(defaultQuery === undefined ? {} : { defaultQuery })}
          {...(defaultHelpOpen === undefined ? {} : { defaultHelpOpen })}
          {...(defaultRecentItems === undefined ? {} : { defaultRecentItems })}
        />
      </div>
    </Providers>
  )
}

function queryResults<T>(request: Request, fixtures: Record<string, T[]>) {
  const query = new URL(request.url).searchParams.get('q') ?? ''
  return fixtures[query] ?? []
}

function jsonByQuery<T>(fixtures: Record<string, T[]>) {
  return ({ request }: { request: Request }) =>
    HttpResponse.json(queryResults(request, fixtures))
}

const meta = {
  title: 'Search/SearchModal',
  component: SearchModalStory,
  parameters: {
    layout: 'fullscreen',
    msw: {
      handlers: [
        http.get(
          '/api/tasks',
          jsonByQuery({
            [keyboardQuery]: [searchTask],
            [scrollableQuery]: scrollableTasks,
            [projectScopeQuery]: [projectScopedTask],
            [taskScopeQuery]: [taskScopedTask],
          }),
        ),
        http.get(`/api/tasks/${searchTask.id}`, () =>
          HttpResponse.json(searchTaskDetail),
        ),
        http.get(`/api/tasks/${numberedTaskNumber}`, () =>
          HttpResponse.json(numberedTask),
        ),
        http.get(
          '/api/projects',
          jsonByQuery({
            '': [searchProject],
            [keyboardQuery]: [searchProject],
          }),
        ),
        http.get(`/api/projects/${searchProject.id}`, () =>
          HttpResponse.json(searchProject),
        ),
        http.get(
          '/api/saved-views',
          jsonByQuery({
            [keyboardQuery]: [searchView],
            [workbenchQuery]: [isolatedView],
          }),
        ),
        http.get('/api/tasks/search/pages', ({ request }) => {
          return HttpResponse.json({
            results: queryResults(request, {
              [keyboardQuery]: [searchPage],
              [projectScopeQuery]: [searchPage],
            }),
          })
        }),
        http.get('/api/tasks/search/suggest', ({ request }) => {
          const prefix = new URL(request.url).searchParams.get('prefix') ?? ''
          return HttpResponse.json(
            suggestions.filter(({ value }) => value.startsWith(prefix)),
          )
        }),
      ],
    },
  },
} satisfies Meta<typeof SearchModalStory>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const AllContexts: Story = {
  args: { defaultContext: null },
}

export const TaskMode: Story = {
  args: { defaultContext: 'work', defaultQuery: `#${keyboardQuery}` },
}

export const ProjectMode: Story = {
  args: { defaultContext: 'work', defaultQuery: `!${keyboardQuery}` },
}

export const PageMode: Story = {
  args: { defaultContext: 'work', defaultQuery: `/${keyboardQuery}` },
}

export const CommandMode: Story = {
  args: { defaultContext: 'work', defaultQuery: '>' },
}

export const RecentlyViewed: Story = {
  args: { defaultContext: 'work', defaultRecentItems: recentItems },
}

export const CrossSearch: Story = {
  args: { defaultContext: 'work', defaultQuery: keyboardQuery },
}

export const ProjectScope: Story = {
  args: { defaultContext: 'work', defaultQuery: projectScopeQuery },
}

export const TaskScope: Story = {
  args: { defaultContext: 'work', defaultQuery: taskScopeQuery },
}

export const ScrollableResults: Story = {
  args: { defaultContext: 'work', defaultQuery: scrollableQuery },
}

export const TaskNumber: Story = {
  args: { defaultContext: 'work', defaultQuery: numberedTaskQuery },
}

export const Suggestions: Story = {
  args: { defaultContext: 'work', defaultQuery: 'is:' },
}

export const HelpOpen: Story = {
  args: { defaultContext: 'work', defaultHelpOpen: true },
}

export const Views: Story = {
  args: { defaultContext: 'work', defaultQuery: workbenchQuery },
}

export const NoResults: Story = {
  args: { defaultContext: null, defaultQuery: 'nothing-matches' },
}

export const SearchEverywhere: Story = {
  args: {
    defaultContext: 'work',
    defaultQuery: `${projectScopeQuery}nothing-matches`,
  },
}
