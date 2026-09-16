import type { Meta, StoryObj } from '@storybook/react-vite'

import { SidebarParentFieldAppearance } from '#components/task/sidebar-parent-field'
import { makeTask } from '#components/task/task-row-test-fixtures'
import { DetailSidebarPanel } from '#components/ui/detail-sidebar-panel'

const existingParentTask = makeTask({
  number: 5,
  title: 'Existing parent',
})

const searchCandidate = makeTask({
  number: 20,
  title: 'Deploy to production',
})

const meta = {
  title: 'Task/TaskDetail/SidebarParentFieldAppearance',
  component: SidebarParentFieldAppearance,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <div className="flex h-64">
        <DetailSidebarPanel>
          <Story />
        </DetailSidebarPanel>
      </div>
    ),
  ],
  args: {
    currentParent: null,
    isEditing: false,
    onOpenChange: () => {},
    query: '',
    onQueryChange: () => {},
    isFetching: false,
    candidates: [],
    onClear: () => {},
    onSelectCandidate: () => {},
  },
} satisfies Meta<typeof SidebarParentFieldAppearance>

export default meta
type Story = StoryObj<typeof meta>

export const NoParent: Story = {}

export const WithParent: Story = {
  args: {
    currentParent: {
      number: existingParentTask.number,
      title: existingParentTask.title,
    },
  },
}

export const Editing: Story = {
  args: {
    isEditing: true,
  },
}

export const EditingWithCandidates: Story = {
  args: {
    isEditing: true,
    query: 'Deploy',
    candidates: [searchCandidate],
  },
}
