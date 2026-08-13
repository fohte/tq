import type { Meta, StoryObj } from '@storybook/react-vite'

import { FullPageLoading } from '#components/ui/full-page-loading'

const meta = {
  title: 'UI/FullPageLoading',
  component: FullPageLoading,
  decorators: [
    (Story) => (
      <div className="h-64 w-96 border border-border">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FullPageLoading>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
