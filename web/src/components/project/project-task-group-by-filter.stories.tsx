import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { ProjectTaskGroupByFilter } from '#components/project/project-task-group-by-filter'
import { makeProjectField } from '#components/project/project-test-fixtures'

const fields = [
  makeProjectField({ id: 'field-category', name: 'SampleCategory' }),
]

const meta = {
  title: 'Project/ProjectTaskGroupByFilter',
  component: ProjectTaskGroupByFilter,
  args: {
    fields,
    onChange: fn(),
  },
} satisfies Meta<typeof ProjectTaskGroupByFilter>

export default meta
type Story = StoryObj<typeof meta>

export const NoGrouping: Story = {
  name: 'the task list has no grouping selected',
}

export const FieldSelected: Story = {
  name: 'the task list is grouped by a project field',
  args: { selectedFieldId: 'field-category' },
}

export const MenuOpen: Story = {
  name: 'the grouping menu is open with the available project fields',
  args: { defaultOpen: true },
}
