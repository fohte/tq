import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { makeTaskPage } from '#components/task/task-page-test-fixtures'
import { TaskPagesList } from '#components/task/task-pages-section'
import type { TaskPage } from '#hooks/use-task-pages'
import { StoryRouter } from '#storybook-config/story-router'

const samplePages: TaskPage[] = [
  makeTaskPage(),
  makeTaskPage({
    id: 'page-002',
    title: 'Technical Spec',
    content:
      '# API Design\n\nREST endpoints for the task management system.\n\n## Endpoints\n\n- GET /tasks\n- POST /tasks\n- PATCH /tasks/:id',
    sortOrder: 1,
    createdAt: '2026-03-21T00:00:00.000Z',
    updatedAt: '2026-03-21T00:00:00.000Z',
  }),
  makeTaskPage({
    id: 'page-003',
    title: 'Empty Page',
    content: '',
    sortOrder: 2,
    createdAt: '2026-03-22T00:00:00.000Z',
    updatedAt: '2026-03-22T00:00:00.000Z',
  }),
]

const sampleHtmlPage: TaskPage = makeTaskPage({
  id: 'page-004',
  title: 'Dashboard Mockup',
  content:
    '<!doctype html><html><body style="font-family: sans-serif; margin: 0; padding: 16px;"><h1>Dashboard</h1></body></html>',
  format: 'html',
  sortOrder: 3,
  createdAt: '2026-03-23T00:00:00.000Z',
  updatedAt: '2026-03-23T00:00:00.000Z',
})

function Providers({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return (
    <QueryClientProvider client={queryClient}>
      <StoryRouter
        component={() => <>{children}</>}
        paths={['/tasks/$taskId/pages/$pageId']}
      />
    </QueryClientProvider>
  )
}

// --- Section Stories ---

function SectionStory({
  taskId,
  pages,
}: {
  taskId: string
  pages: TaskPage[]
}) {
  return (
    <Providers>
      <div className="max-w-2xl p-6">
        <TaskPagesList taskId={taskId} pages={pages} onAddPage={() => {}} />
      </div>
    </Providers>
  )
}

const meta = {
  title: 'Task/TaskPages/Section',
  component: SectionStory,
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof SectionStory>

export default meta
type SectionStoryType = StoryObj<typeof meta>

export const WithPages: SectionStoryType = {
  args: { taskId: 'task-001', pages: samplePages },
}

export const Empty: SectionStoryType = {
  args: { taskId: 'task-empty', pages: [] },
}

const [firstPage] = samplePages

export const SinglePage: SectionStoryType = {
  args: { taskId: 'task-single', pages: firstPage ? [firstPage] : [] },
}

export const WithHtmlPage: SectionStoryType = {
  args: { taskId: 'task-001', pages: [...samplePages, sampleHtmlPage] },
}
