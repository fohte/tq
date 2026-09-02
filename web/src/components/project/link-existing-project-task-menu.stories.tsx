import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, fn, within } from 'storybook/test'

import { LinkExistingProjectTaskMenu } from '#components/project/link-existing-project-task-menu'
import { makeProject } from '#components/project/project-test-fixtures'
import { makeTask } from '#components/task/task-row-test-fixtures'
import { type Project, projectKeys } from '#hooks/use-projects'
import { searchKeys, type SearchResult } from '#hooks/use-search'

const projectId = '00000000-0000-0000-0000-000000000001'
const projectTitle = 'ISUCON14'
const searchText = 'Deploy'

const otherProject: Project = makeProject({
  id: '00000000-0000-0000-0000-000000000099',
  title: 'Website Redesign',
})

const orphanCandidate: SearchResult = makeTask({
  id: '00000000-0000-0000-0000-000000000011',
  number: 12,
  title: 'Deploy to production',
  context: 'work',
})

const candidateWithProject: SearchResult = makeTask({
  id: '00000000-0000-0000-0000-000000000012',
  number: 34,
  title: 'Deploy docs site',
  context: 'work',
  projectId: otherProject.id,
})

// A fresh QueryClient per story (rather than a shared module-level one) so
// seeded search/project data doesn't leak across stories in the same run.
function createSeededQueryClient(candidates: SearchResult[]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  client.setQueryData(searchKeys.results(searchText), candidates)
  client.setQueryData(projectKeys.list(undefined), [otherProject])
  client.setQueryData(projectKeys.taskIds(projectId), [])
  return client
}

const meta = {
  title: 'Project/LinkExistingProjectTaskMenu',
  component: LinkExistingProjectTaskMenu,
  parameters: {
    layout: 'centered',
  },
  args: {
    open: true,
    onOpenChange: fn(),
    projectId,
    projectTitle,
  },
} satisfies Meta<typeof LinkExistingProjectTaskMenu>

export default meta
type Story = StoryObj<typeof meta>

export const WithCandidates: Story = {
  decorators: [
    (Story) => (
      <QueryClientProvider
        client={createSeededQueryClient([
          orphanCandidate,
          candidateWithProject,
        ])}
      >
        <Story />
      </QueryClientProvider>
    ),
  ],
  play: async ({ canvasElement, userEvent }) => {
    const body = within(canvasElement.ownerDocument.body)

    const input = await body.findByPlaceholderText(/Search tasks/i)
    await userEvent.type(input, searchText)

    await expect(
      await body.findByText('Deploy to production'),
    ).toBeInTheDocument()
    await expect(body.getByText('Deploy docs site')).toBeInTheDocument()

    await userEvent.click(body.getByText('Deploy docs site'))

    await expect(
      await body.findByText('Move to this project?'),
    ).toBeInTheDocument()
    await expect(
      body.getByText(
        '#34 Deploy docs site currently belongs to Website Redesign. It will be moved to ISUCON14.',
      ),
    ).toBeInTheDocument()
  },
}

export const NoResults: Story = {
  decorators: [
    (Story) => (
      <QueryClientProvider client={createSeededQueryClient([])}>
        <Story />
      </QueryClientProvider>
    ),
  ],
  play: async ({ canvasElement, userEvent }) => {
    const body = within(canvasElement.ownerDocument.body)

    const input = await body.findByPlaceholderText(/Search tasks/i)
    await userEvent.type(input, searchText)

    await expect(
      await body.findByText(`no results for "${searchText}"`),
    ).toBeInTheDocument()
  },
}
