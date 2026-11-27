import type { Meta, StoryObj } from '@storybook/react-vite'

import { ProjectTaskFieldGroup } from '#components/project/project-task-field-group'

const meta = {
  title: 'Project/ProjectTaskFieldGroup',
  component: ProjectTaskFieldGroup,
  args: {
    title: 'Alpha',
    children: (
      <div className="px-3 pb-3 font-mono text-xs text-muted-foreground">
        Tasks with this value appear here.
      </div>
    ),
  },
} satisfies Meta<typeof ProjectTaskFieldGroup>

export default meta
type Story = StoryObj<typeof meta>

export const Option: Story = {
  name: 'the task list shows a group for one field option',
}

export const Unset: Story = {
  name: 'the task list shows a group for tasks without a value',
  args: { title: 'Unset' },
}

export const LoadError: Story = {
  name: 'the task list shows when a group failed to load',
  args: { isError: true },
}

export const StaleTasksWithLoadError: Story = {
  name: 'the task list keeps cached tasks while showing a load error',
  args: { isError: true, hasTasks: true },
}
