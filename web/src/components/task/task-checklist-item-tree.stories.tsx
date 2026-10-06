import { Panel } from '@fohte/ui/panel'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { TaskChecklistItemTree } from '#components/task/task-checklist-item-tree'
import { makeTaskChecklistItem } from '#components/task/task-checklist-test-fixtures'
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
  initiallyCollapsedItemIds,
  initiallyExpandedNoteItemIds,
}: {
  items: typeof items
  initiallyCollapsedItemIds?: string[]
  initiallyExpandedNoteItemIds?: string[]
}) {
  return (
    <Providers>
      <div className="max-w-2xl p-6">
        <Panel padding="none">
          <TaskChecklistItemTree
            items={storyItems}
            addingItemParentId={undefined}
            onCancelAddingItem={() => {}}
            onCreateItem={() => {}}
            onUpdateItem={() => {}}
            onDeleteItem={() => {}}
            onMoveItem={() => {}}
            onSetItemChecked={() => {}}
            onStartAddingItem={() => {}}
            initiallyCollapsedItemIds={initiallyCollapsedItemIds}
            initiallyExpandedNoteItemIds={initiallyExpandedNoteItemIds}
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
