import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'

import { AppLayout } from '#components/layout/app-layout'
import { StoryRouter } from '#storybook-config/story-router'

function AppLayoutStory() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })

  return (
    <QueryClientProvider client={queryClient}>
      <AppLayout>
        <div className="flex items-center justify-center p-8 text-muted-foreground">
          Page Content
        </div>
      </AppLayout>
    </QueryClientProvider>
  )
}

function AppLayoutWithRouter({ currentPath }: { currentPath: string }) {
  return <StoryRouter component={AppLayoutStory} initialPath={currentPath} />
}

const meta = {
  title: 'Layout/AppLayout',
  component: AppLayoutWithRouter,
  parameters: {
    layout: 'fullscreen',
    msw: {
      handlers: [
        http.get('/api/tasks', () => HttpResponse.json([])),
        http.get('/api/projects', () => HttpResponse.json([])),
        http.get('/api/queues/:key/items', () => HttpResponse.json([])),
        http.get('/api/saved-views', () => HttpResponse.json([])),
        http.get('/api/labels', () => HttpResponse.json([])),
      ],
    },
  },
  argTypes: {
    currentPath: {
      control: 'select',
      options: ['/', '/tasks', '/today', '/projects'],
    },
  },
} satisfies Meta<typeof AppLayoutWithRouter>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'the application shell shows its sidebar on the home route',
  args: {
    currentPath: '/',
  },
}

export const TasksPage: Story = {
  name: 'the application shell shows the task route beside its sidebar',
  args: {
    currentPath: '/tasks',
  },
}
