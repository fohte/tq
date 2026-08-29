import type { Meta, StoryObj } from '@storybook/react-vite'

import { Textarea } from '#components/ui/textarea'

const meta = {
  title: 'UI/Textarea',
  component: Textarea,
  tags: ['autodocs'],
} satisfies Meta<typeof Textarea>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {},
}

export const WithValue: Story = {
  args: {
    defaultValue: '- [ ] Review PR\n- [ ] Update docs\n- [ ] Deploy to staging',
  },
}

export const Disabled: Story = {
  args: {
    placeholder: 'Add description...',
    disabled: true,
  },
}

export const Placeholder: Story = {
  args: {
    placeholder: 'Add description...',
  },
}
