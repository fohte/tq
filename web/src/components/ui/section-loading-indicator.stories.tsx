import type { Meta, StoryObj } from '@storybook/react-vite'

import { SectionLoadingIndicator } from '#components/ui/section-loading-indicator'

const meta = {
  title: 'UI/SectionLoadingIndicator',
  component: SectionLoadingIndicator,
  tags: ['autodocs'],
} satisfies Meta<typeof SectionLoadingIndicator>

export default meta
type Story = StoryObj<typeof meta>

export const Pages: Story = {
  name: 'shows a loading indicator for the pages section',
  args: {
    label: 'pages',
  },
}

export const Subtasks: Story = {
  name: 'shows a loading indicator for the subtasks section',
  args: {
    label: 'subtasks',
  },
}
