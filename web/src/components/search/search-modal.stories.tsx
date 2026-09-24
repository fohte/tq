import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { useState } from 'react'

import { makeSavedView } from '#components/layout/sidebar-test-fixtures'
import { makeProject } from '#components/project/project-test-fixtures'
import { SearchModal } from '#components/search/search-modal'
import { makePageSearchResult } from '#components/search/search-test-fixtures'
import {
  makeTask,
  makeTaskDetail,
} from '#components/task/task-row-test-fixtures'
import { StoryRouter } from '#storybook-config/story-router'

const searchTask = makeTask({
  id: '00000000-0000-0000-0000-000000000042',
  number: 42,
  title: 'Keyboard shortcuts',
  context: 'work',
})

const searchProject = makeProject({
  id: '00000000-0000-0000-0000-000000000142',
  title: 'Keyboard navigation',
  context: 'work',
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

const searchPage = makePageSearchResult({
  taskNumber: searchTask.number,
  taskTitle: searchTask.title,
  pageId: 'keyboard-shortcuts',
  pageTitle: 'Keyboard shortcuts',
  snippet: 'Keyboard shortcuts for searching and navigation.',
})

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
}: {
  defaultContext?: 'work' | 'personal' | null
  defaultQuery?: string
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
          {...(defaultContext === undefined ? {} : { defaultContext })}
          {...(defaultQuery === undefined ? {} : { defaultQuery })}
        />
      </div>
    </Providers>
  )
}

const meta = {
  title: 'Search/SearchModal',
  component: SearchModalStory,
  parameters: {
    layout: 'fullscreen',
    msw: {
      handlers: [
        http.get('/api/tasks', ({ request }) => {
          const query = new URL(request.url).searchParams.get('q')
          return HttpResponse.json(query === 'keyboard' ? [searchTask] : [])
        }),
        http.get('/api/tasks/312', () => HttpResponse.json(numberedTask)),
        http.get('/api/projects', ({ request }) => {
          const query = new URL(request.url).searchParams.get('q')
          return HttpResponse.json(query === 'keyboard' ? [searchProject] : [])
        }),
        http.get('/api/saved-views', ({ request }) => {
          const query = new URL(request.url).searchParams.get('q')
          return HttpResponse.json(
            query === 'keyboard'
              ? [searchView]
              : query === 'workbench'
                ? [isolatedView]
                : [],
          )
        }),
        http.get('/api/tasks/search/pages', ({ request }) => {
          const query = new URL(request.url).searchParams.get('q')
          return HttpResponse.json({
            results: query === 'keyboard' ? [searchPage] : [],
          })
        }),
        http.get('/api/tasks/search/suggest', ({ request }) => {
          const prefix = new URL(request.url).searchParams.get('prefix') ?? ''
          const suggestions = [
            { value: 'is:todo', display: 'Todo', category: 'is' },
            { value: 'is:completed', display: 'Completed', category: 'is' },
          ]
          return HttpResponse.json(
            suggestions.filter((suggestion) =>
              suggestion.value.startsWith(prefix),
            ),
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
  args: { defaultContext: 'work', defaultQuery: '#keyboard' },
}

export const ProjectMode: Story = {
  args: { defaultContext: 'work', defaultQuery: '!keyboard' },
}

export const PageMode: Story = {
  args: { defaultContext: 'work', defaultQuery: '/keyboard' },
}

export const CrossSearch: Story = {
  args: { defaultContext: 'work', defaultQuery: 'keyboard' },
}

export const TaskNumber: Story = {
  args: { defaultContext: 'work', defaultQuery: '#312' },
}

export const Suggestions: Story = {
  args: { defaultContext: 'work', defaultQuery: 'is:' },
}

export const Views: Story = {
  args: { defaultContext: 'work', defaultQuery: 'workbench' },
}

export const NoResults: Story = {
  args: { defaultContext: 'work', defaultQuery: 'nothing-matches' },
}
