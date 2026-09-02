import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { LinkExistingTaskDialog } from '#components/task/link-existing-task-dialog'
import { makeTask } from '#components/task/task-row-test-fixtures'
import type { SearchResult } from '#hooks/use-search'

const candidate: SearchResult = makeTask({
  id: '00000000-0000-0000-0000-000000000001',
  number: 34,
  title: 'Deploy docs site',
  context: 'work',
  parentId: '00000000-0000-0000-0000-000000000099',
  parentNumber: 3,
})

const meta = {
  title: 'Task/LinkExistingTaskDialog',
  component: LinkExistingTaskDialog,
  args: {
    onOpenChange: fn(),
    onConfirm: fn(),
  },
} satisfies Meta<typeof LinkExistingTaskDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Open: Story = {
  args: {
    candidate,
    parentTaskNumber: 1,
    open: true,
  },
}
