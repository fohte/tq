import type { Meta, StoryObj } from '@storybook/react-vite'

import { SectionLabel } from '#components/ui/section-label'

const meta = {
  title: 'UI/SectionLabel',
  component: SectionLabel,
  tags: ['autodocs'],
} satisfies Meta<typeof SectionLabel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    children: 'DETAILS',
  },
}
