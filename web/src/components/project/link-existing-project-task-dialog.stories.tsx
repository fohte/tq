import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { LinkExistingProjectTaskDialog } from '#components/project/link-existing-project-task-dialog'
import { makeTask } from '#components/task/task-row-test-fixtures'
import type { SearchResult } from '#hooks/use-search'

const candidate: SearchResult = makeTask({
  id: '00000000-0000-0000-0000-000000000001',
  number: 34,
  title: 'Deploy docs site',
  context: 'work',
  projectId: '00000000-0000-0000-0000-000000000099',
})

const meta = {
  title: 'Project/LinkExistingProjectTaskDialog',
  component: LinkExistingProjectTaskDialog,
  args: {
    onOpenChange: fn(),
    onConfirm: fn(),
  },
} satisfies Meta<typeof LinkExistingProjectTaskDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Open: Story = {
  args: {
    candidate,
    currentProjectTitle: 'Website Redesign',
    projectTitle: 'ISUCON14',
    open: true,
  },
}

export const UnknownCurrentProject: Story = {
  args: {
    candidate,
    currentProjectTitle: undefined,
    projectTitle: 'ISUCON14',
    open: true,
  },
}
