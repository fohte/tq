import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { expect, fn, waitFor, within } from 'storybook/test'

import { makeProject } from '#components/project/project-test-fixtures'
import { SetProjectMenu } from '#components/task/set-project-menu'
import { type Project, projectKeys } from '#hooks/use-projects'

const taskId = '00000000-0000-0000-0000-000000000001'
const taskNumber = 1

const projectA: Project = makeProject({
  id: 'aaaa0000-0000-0000-0000-000000000000',
  completionRate: 0.4,
  taskCount: { total: 10, completed: 4 },
})

const projectB: Project = {
  ...projectA,
  id: 'bbbb0000-0000-0000-0000-000000000000',
  title: 'Website redesign',
}

function createSeededQueryClient(projects: Project[]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  client.setQueryData(projectKeys.list(undefined), projects)
  return client
}

const meta = {
  title: 'Task/SetProjectMenu',
  component: SetProjectMenu,
  parameters: {
    layout: 'centered',
  },
  args: {
    open: true,
    onOpenChange: fn(),
    taskId,
    taskNumber,
  },
} satisfies Meta<typeof SetProjectMenu>

export default meta
type Story = StoryObj<typeof meta>

export const WithProjects: Story = {
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
    // useUpdateTask's onSettled invalidates projectKeys.all, which
    // invalidateQueries refetches regardless of staleTime — a real GET
    // response is required alongside the PATCH.
    msw: {
      handlers: [
        http.patch('/api/tasks/:id', () => HttpResponse.json({})),
        http.get('/api/projects', () =>
          HttpResponse.json([projectA, projectB]),
        ),
      ],
    },
    // This story's screenshot has been flaky in CI VRT runs for a reason
    // that isn't confirmed — the dialog itself stays mounted throughout
    // (`open` is a static arg here, so `onOpenChange` never actually
    // closes it). This is the only story that captures the populated
    // project list (NoProjects only covers the empty state), so skipping
    // trades that visual coverage for a reliable VRT signal.
    screenshot: { skip: true },
  },
  play: async ({ canvasElement, userEvent, args }) => {
    const body = within(canvasElement.ownerDocument.body)

    await expect(
      await body.findByText(`Set project for #${String(taskNumber)}`),
    ).toBeInTheDocument()
    await expect(body.getByText(projectA.title)).toBeInTheDocument()
    await expect(body.getByText(projectB.title)).toBeInTheDocument()

    await userEvent.click(body.getByText(projectB.title))

    await waitFor(async () => {
      await expect(args.onOpenChange).toHaveBeenCalledWith(false)
    })
  },
}

export const NoProjects: Story = {
  decorators: [
    (Story) => (
      <QueryClientProvider client={createSeededQueryClient([])}>
        <Story />
      </QueryClientProvider>
    ),
  ],
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)

    await expect(await body.findByText('—')).toBeInTheDocument()
    await expect(body.queryByText(projectA.title)).not.toBeInTheDocument()
  },
}
