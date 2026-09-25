import type { Meta, StoryObj } from '@storybook/react-vite'

import { GithubMarkIcon } from '#components/ui/github-mark-icon'

const meta = {
  title: 'UI/GithubMarkIcon',
  component: GithubMarkIcon,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div className="dark bg-background p-4 text-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof GithubMarkIcon>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'shows the GitHub mark on a dark surface',
  args: {
    className: 'size-6',
  },
}
