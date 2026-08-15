import type { Meta, StoryObj } from '@storybook/react-vite'

import { Checkbox } from '#components/ui/checkbox'

const meta = {
  title: 'UI/Checkbox',
  component: Checkbox,
  tags: ['autodocs'],
  parameters: {
    // The root's `after:-inset-x-3 after:-inset-y-2` enlarges its invisible
    // touch/click target beyond the visible 16px box — deliberate hit-slop,
    // not a visual overflow. Same exemption needed anywhere else Checkbox
    // renders: field.stories.tsx's Horizontal story, gcal-calendar-checklist
    // and gcal-calendar-picker's Expanded story.
    overflowCheck: { ignoreSelectors: ['[data-slot="checkbox"]'] },
  },
} satisfies Meta<typeof Checkbox>

export default meta
type Story = StoryObj<typeof meta>

export const Unchecked: Story = {
  args: {},
}

export const Checked: Story = {
  args: {
    defaultChecked: true,
  },
}

export const Disabled: Story = {
  args: {
    disabled: true,
  },
}

export const DisabledChecked: Story = {
  args: {
    disabled: true,
    defaultChecked: true,
  },
}
