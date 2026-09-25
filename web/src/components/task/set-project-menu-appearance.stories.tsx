import type { Meta, StoryObj } from '@storybook/react-vite'

import { makeProject } from '#components/project/project-test-fixtures'
import { SetProjectMenuAppearance } from '#components/task/set-project-menu'

const projectA = makeProject({
  id: 'aaaa0000-0000-0000-0000-000000000000',
  title: 'tq',
  completionRate: 0.4,
  taskCount: { total: 10, completed: 4 },
})

const projectB = makeProject({
  id: 'bbbb0000-0000-0000-0000-000000000000',
  title: 'Website redesign',
})

const meta = {
  title: 'Task/SetProjectMenuAppearance',
  component: SetProjectMenuAppearance,
  parameters: {
    layout: 'centered',
  },
  args: {
    open: true,
    onOpenChange: () => {},
    taskNumber: 1,
    projects: [projectA, projectB],
    onSelectProject: () => {},
  },
} satisfies Meta<typeof SetProjectMenuAppearance>

export default meta
type Story = StoryObj<typeof meta>

export const WithProjects: Story = {
  name: 'the menu lists the available projects for the task.',
}

export const NoProjects: Story = {
  name: 'the menu shows its empty state when no projects are available.',
  args: {
    projects: [],
  },
}
