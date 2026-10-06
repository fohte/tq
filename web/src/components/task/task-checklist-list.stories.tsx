import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { TaskChecklistList } from '#components/task/task-checklist-list'
import {
  makeTaskChecklist,
  makeTaskChecklistItem,
} from '#components/task/task-checklist-test-fixtures'
import { StoryRouter } from '#storybook-config/story-router'

const backpackId = '30000000-0000-4000-8000-000000000101'
const clothesId = '30000000-0000-4000-8000-000000000102'
const glovesId = '30000000-0000-4000-8000-000000000103'

const nestedChecklist = makeTaskChecklist({
  name: 'Camping trip',
  items: [
    makeTaskChecklistItem({
      id: backpackId,
      content: 'Backpack',
      children: [
        makeTaskChecklistItem({
          id: '30000000-0000-4000-8000-000000000104',
          parentItemId: backpackId,
          content: 'Headlamp',
          checkedAt: '2026-01-02T00:00:00.000Z',
        }),
        makeTaskChecklistItem({
          id: clothesId,
          parentItemId: backpackId,
          content: 'Clothes',
          children: [
            makeTaskChecklistItem({
              id: glovesId,
              parentItemId: clothesId,
              content: 'Gloves',
              checkedAt: '2026-01-02T00:00:00.000Z',
            }),
            makeTaskChecklistItem({
              id: '30000000-0000-4000-8000-000000000105',
              parentItemId: clothesId,
              content: 'Fleece jacket',
              note: 'Keep this in the dry bag.',
            }),
          ],
        }),
        makeTaskChecklistItem({
          id: '30000000-0000-4000-8000-000000000106',
          parentItemId: backpackId,
          content: 'Water bottle',
        }),
      ],
    }),
    makeTaskChecklistItem({
      id: '30000000-0000-4000-8000-000000000107',
      sortOrder: 1,
      content: 'Turn off the gas',
      checkedAt: '2026-01-02T00:00:00.000Z',
    }),
  ],
})

const checklistActions = {
  onCreateChecklist: () => {},
  onUpdateChecklist: () => {},
  onReorderChecklists: () => {},
  onDeleteChecklist: () => {},
  onCreateItem: () => {},
  onUpdateItem: () => {},
  onDeleteItem: () => {},
  onMoveItem: () => {},
  onSetItemChecked: () => {},
}

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

const meta = {
  title: 'Task/Checklists/List',
  component: TaskChecklistList,
  render: (args) => (
    <Providers>
      <TaskChecklistList {...args} />
    </Providers>
  ),
  parameters: { layout: 'padded' },
  args: checklistActions,
} satisfies Meta<typeof TaskChecklistList>

export default meta
type Story = StoryObj<typeof meta>

export const NestedItems: Story = {
  name: 'a checklist shows nested items and their progress',
  args: { checklists: [nestedChecklist] },
}

export const UnnamedChecklist: Story = {
  name: 'an unnamed checklist has no header row',
  args: {
    checklists: [
      makeTaskChecklist({
        name: null,
        items: [makeTaskChecklistItem({ content: 'Bring a rain jacket' })],
      }),
    ],
  },
}

export const Empty: Story = {
  name: 'a task can start with no checklists',
  args: { checklists: [] },
}
