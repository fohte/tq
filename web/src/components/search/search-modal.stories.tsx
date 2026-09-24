import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { useState } from 'react'

import { makeProject } from '#components/project/project-test-fixtures'
import { SearchModal } from '#components/search/search-modal'
import { makePageSearchResult } from '#components/search/search-modal-test-fixtures'
import { makeTask } from '#components/task/task-row-test-fixtures'
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
        http.get('/api/tasks', () => HttpResponse.json([searchTask])),
        http.get('/api/projects', () => HttpResponse.json([searchProject])),
        http.get('/api/tasks/search/pages', () =>
          HttpResponse.json({ results: [searchPage] }),
        ),
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
