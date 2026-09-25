import type { Meta, StoryObj } from '@storybook/react-vite'

import { Badge } from '#components/ui/badge'

const meta = {
  title: 'UI/Badge',
  component: Badge,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'default',
        'secondary',
        'destructive',
        'outline',
        'ghost',
        'link',
      ],
    },
  },
} satisfies Meta<typeof Badge>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'shows the Badge label in the default badge style',
  args: {
    children: 'Badge',
  },
}

export const Secondary: Story = {
  name: 'shows a secondary badge labeled Secondary',
  args: {
    variant: 'secondary',
    children: 'Secondary',
  },
}

export const Destructive: Story = {
  name: 'shows a destructive badge labeled Destructive',
  args: {
    variant: 'destructive',
    children: 'Destructive',
  },
}

export const Outline: Story = {
  name: 'shows an outlined badge labeled Outline',
  args: {
    variant: 'outline',
    children: 'Outline',
  },
}

export const Ghost: Story = {
  name: 'shows a ghost badge labeled Ghost',
  args: {
    variant: 'ghost',
    children: 'Ghost',
  },
}

export const AllVariants: Story = {
  name: 'compares default, secondary, destructive, outline, ghost, and link badges',
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Badge variant="default">Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="destructive">Destructive</Badge>
      <Badge variant="outline">Outline</Badge>
      <Badge variant="ghost">Ghost</Badge>
      <Badge variant="link">Link</Badge>
    </div>
  ),
}

export const ContextChip: Story = {
  name: 'shows an outlined badge for a bug label',
  args: {
    variant: 'outline',
    children: '#bug',
  },
}
