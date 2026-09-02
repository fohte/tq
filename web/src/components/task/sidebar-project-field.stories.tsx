import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { expect, userEvent, waitFor, within } from 'storybook/test'

import { makeProject } from '#components/project/project-test-fixtures'
import { SidebarProjectField } from '#components/task/sidebar-project-field'
import { type Project, projectKeys } from '#hooks/use-projects'
import { clickSelectOption } from '#lib/test-utils'

const taskId = '00000000-0000-0000-0000-000000000001'

const projectA: Project = makeProject({
  id: 'aaaa0000-0000-0000-0000-000000000000',
  completionRate: 0.4,
  taskCount: { total: 10, completed: 4 },
})

const projectB: Project = makeProject({
  id: 'bbbb0000-0000-0000-0000-000000000000',
  title: 'Website redesign',
  completionRate: 0.4,
  taskCount: { total: 10, completed: 4 },
})

function createSeededQueryClient(projects: Project[]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  client.setQueryData(projectKeys.list(undefined), projects)
  return client
}

const meta = {
  title: 'Task/TaskDetail/SidebarProjectField',
  component: SidebarProjectField,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div className="relative w-56 border-l border-border p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SidebarProjectField>

export default meta
type Story = StoryObj<typeof meta>

export const NoProject: Story = {
  args: {
    taskId,
    projectId: null,
  },
  decorators: [
    (Story) => (
      <QueryClientProvider
        client={createSeededQueryClient([projectA, projectB])}
      >
        <Story />
      </QueryClientProvider>
    ),
  ],
}

export const WithProject: Story = {
  args: {
    taskId,
    projectId: projectA.id,
  },
  decorators: [
    (Story) => (
      <QueryClientProvider
        client={createSeededQueryClient([projectA, projectB])}
      >
        <Story />
      </QueryClientProvider>
    ),
  ],
}

// The Select is controlled by the `projectId` prop, so a real selection
// never visibly updates the trigger in this story (the story's args never
// change) — the PATCH request body is what actually proves the NO_PROJECT
// sentinel resolves to the right projectId.
let patchedBody: unknown = null

export const SelectProject: Story = {
  args: {
    taskId,
    projectId: null,
  },
  decorators: [
    (Story) => (
      <QueryClientProvider
        client={createSeededQueryClient([projectA, projectB])}
      >
        <Story />
      </QueryClientProvider>
    ),
  ],
  parameters: {
    // The Select is controlled by the `projectId` prop, which this story
    // never updates after selecting — the trigger still reads null,
    // identical to NoProject.
    screenshot: { skip: true },
    msw: {
      handlers: [
        http.patch('/api/tasks/:id', async ({ request }) => {
          patchedBody = await request.json()
          return HttpResponse.json({})
        }),
        http.get('/api/projects', () =>
          HttpResponse.json([projectA, projectB]),
        ),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    patchedBody = null
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)

    await userEvent.click(canvas.getByRole('combobox'))
    await clickSelectOption(userEvent, await body.findByText(projectB.title))

    await waitFor(async () => {
      await expect(patchedBody).toEqual({ projectId: projectB.id })
    })
  },
}
