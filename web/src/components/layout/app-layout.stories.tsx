import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { expect } from 'storybook/test'

import { AppLayout } from '#components/layout/app-layout'
import { assertDefined } from '#lib/test-utils'
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
        http.get('/api/schedule/today-tasks', () => HttpResponse.json([])),
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
  args: {
    currentPath: '/',
  },
}

export const TasksPage: Story = {
  args: {
    currentPath: '/tasks',
  },
}

// Regression check: the visual-viewport insets cap this shell's own height
// for keyboard avoidance (see app-layout.tsx), but content taller than one
// viewport must still push the *document* scrollable, not just this shell.
export const TallPageStillScrollsDocument: Story = {
  args: {
    currentPath: '/tasks',
  },
  parameters: {
    screenshot: { skip: true },
    msw: {
      handlers: [
        http.get('/api/tasks', () => HttpResponse.json([])),
        http.get('/api/projects', () => HttpResponse.json([])),
        http.get('/api/schedule/today-tasks', () => HttpResponse.json([])),
        http.get('/api/saved-views', () => HttpResponse.json([])),
        http.get('/api/labels', () => HttpResponse.json([])),
      ],
    },
  },
  render: () => (
    <StoryRouter
      component={() => (
        <QueryClientProvider
          client={
            new QueryClient({
              defaultOptions: {
                queries: { retry: false, staleTime: Infinity },
              },
            })
          }
        >
          <AppLayout>
            <div style={{ height: 3000 }} />
          </AppLayout>
        </QueryClientProvider>
      )}
      initialPath="/tasks"
    />
  ),
  play: async ({ canvasElement }) => {
    const view = assertDefined(
      canvasElement.ownerDocument.defaultView,
      'a mounted story always has an owner window',
    )

    await expect(view.document.documentElement.scrollHeight).toBeGreaterThan(
      view.innerHeight,
    )

    const sidebar = assertDefined(
      canvasElement.querySelector('aside'),
      'the sidebar should render at desktop viewport widths',
    )
    view.scrollTo(0, view.innerHeight * 2)
    await expect(sidebar.getBoundingClientRect().top).toBe(0)
  },
}
