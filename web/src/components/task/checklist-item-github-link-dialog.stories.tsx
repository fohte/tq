import type { Meta, StoryObj } from '@storybook/react-vite'

import { ChecklistItemGithubLinkDialog } from '#components/task/checklist-item-github-link-dialog'

const meta = {
  title: 'Task/Checklists/GithubLinkDialog',
  component: ChecklistItemGithubLinkDialog,
  args: {
    open: true,
    onOpenChange: () => {},
    itemContent: 'Add the validation route',
    onSubmit: () => {},
  },
  parameters: { layout: 'centered' },
} satisfies Meta<typeof ChecklistItemGithubLinkDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Open: Story = {
  name: 'the dialog asks for a pull request URL',
}
