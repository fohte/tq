import type { Meta, StoryObj } from '@storybook/react-vite'

import { ChecklistItemGithubLinkDialog } from '#components/task/checklist-item-github-link-dialog'

const meta = {
  title: 'Task/Checklists/GithubLinkDialog',
  component: ChecklistItemGithubLinkDialog,
  args: {
    open: true,
    onOpenChange: () => {},
    itemContent: 'Add the validation route',
    errorMessage: undefined,
    defaultShowError: false,
    isPending: false,
    onSubmit: () => {},
  },
  parameters: { layout: 'centered' },
} satisfies Meta<typeof ChecklistItemGithubLinkDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Open: Story = {
  name: 'the dialog asks for a pull request URL',
}

export const Submitting: Story = {
  name: 'the dialog shows that the pull request is being linked',
  args: { isPending: true },
}

export const Failed: Story = {
  name: 'the dialog keeps the URL when the pull request cannot be linked',
  args: {
    errorMessage: 'This URL must point to a pull request.',
    defaultShowError: true,
  },
}
