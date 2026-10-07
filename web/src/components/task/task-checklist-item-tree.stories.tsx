import { Panel } from '@fohte/ui/panel'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { makeGithubLink } from '#components/task/github-link-test-fixtures'
import { TaskChecklistItemTree } from '#components/task/task-checklist-item-tree'
import { makeTaskChecklistItem } from '#components/task/task-checklist-test-fixtures'
import { makeTask } from '#components/task/task-row-test-fixtures'
import type { GithubLink } from '#hooks/use-github-link'
import type { Task } from '#hooks/use-tasks'
import { StoryRouter } from '#storybook-config/story-router'

const rootId = '30000000-0000-4000-8000-000000000201'
const childId = '30000000-0000-4000-8000-000000000202'
const grandchildId = '30000000-0000-4000-8000-000000000203'

const items = [
  makeTaskChecklistItem({
    id: rootId,
    content: 'Pack a backpack',
    children: [
      makeTaskChecklistItem({
        id: childId,
        parentItemId: rootId,
        content: 'Pack clothes',
        children: [
          makeTaskChecklistItem({
            id: grandchildId,
            parentItemId: childId,
            content: 'Pack socks',
            checkedAt: '2026-01-02T00:00:00.000Z',
            note: 'Bring an extra pair.',
          }),
        ],
      }),
    ],
  }),
]

const linkedPullRequest = makeGithubLink({
  id: 'link-linked-pr',
  owner: 'example-org',
  repo: 'sample-app',
  number: 14,
  kind: 'pull_request',
  url: 'https://github.com/example-org/sample-app/pull/14',
  state: 'merged',
})
const promotedSubtask = makeTask({
  id: '50000000-0000-4000-8000-000000000204',
  number: 27,
  title: 'Add retry handling',
  parentId: '10000000-0000-4000-8000-000000000001',
})
const linkedItems = [
  makeTaskChecklistItem({
    id: '30000000-0000-4000-8000-000000000204',
    content: 'Merge the API change',
    checkedAt: '2026-01-02T00:00:00.000Z',
    githubLinkId: linkedPullRequest.id,
  }),
  makeTaskChecklistItem({
    id: '30000000-0000-4000-8000-000000000205',
    content: 'Add retry handling',
    subtaskId: promotedSubtask.id,
  }),
]

function Providers({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })

  return (
    <QueryClientProvider client={queryClient}>
      <StoryRouter
        component={() => <>{children}</>}
        paths={['/tasks/$taskId']}
      />
    </QueryClientProvider>
  )
}

function ItemTreeStory({
  items: storyItems,
  githubLinks = [],
  subtasks = [],
  initiallyCollapsedItemIds,
}: {
  items: typeof items
  githubLinks?: GithubLink[]
  subtasks?: Task[]
  initiallyCollapsedItemIds?: string[]
}) {
  return (
    <Providers>
      <div className="max-w-2xl p-6">
        <Panel padding="none">
          <TaskChecklistItemTree
            items={storyItems}
            githubLinks={githubLinks}
            subtasks={subtasks}
            addingItemParentId={undefined}
            onCancelAddingItem={() => {}}
            onCreateItem={() => {}}
            onUpdateItem={() => {}}
            onDeleteItem={() => {}}
            onMoveItem={() => {}}
            onSetItemChecked={() => {}}
            onLinkGithub={() => {}}
            onPromoteItem={() => {}}
            onStartAddingItem={() => {}}
            initiallyCollapsedItemIds={initiallyCollapsedItemIds}
          />
        </Panel>
      </div>
    </Providers>
  )
}

const meta = {
  title: 'Task/Checklists/ItemTree',
  component: ItemTreeStory,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof ItemTreeStory>

export default meta
type Story = StoryObj<typeof meta>

export const ThreeLevels: Story = {
  name: 'items can be nested across three levels',
  args: { items },
}

export const Collapsed: Story = {
  name: 'a parent item can hide its children',
  args: { items, initiallyCollapsedItemIds: [rootId] },
}

export const LinkedItems: Story = {
  name: 'linked pull requests and subtasks appear beside their items',
  args: {
    items: linkedItems,
    githubLinks: [linkedPullRequest],
    subtasks: [promotedSubtask],
  },
}
