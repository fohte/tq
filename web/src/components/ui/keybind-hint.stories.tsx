import type { Meta, StoryObj } from '@storybook/react-vite'

import { KeybindHint } from '#components/ui/keybind-hint'

const meta = {
  title: 'UI/KeybindHint',
  component: KeybindHint,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['plain', 'boxed'],
    },
  },
} satisfies Meta<typeof KeybindHint>

export default meta
type Story = StoryObj<typeof meta>

export const Plain: Story = {
  name: 'shows a dim keyboard shortcut for sidebar navigation',
  args: {
    children: 'g t',
  },
}

// The plain variant defaults to the dimmest gray tier (sidebar nav hints).
// Brighter contexts, like the status line's `⌘K search`, override the color
// via className instead of a dedicated variant.
export const PlainBright: Story = {
  name: 'shows a brighter shortcut for the command palette',
  args: {
    className: 'text-muted-foreground-strong',
    children: '⌘K',
  },
}

export const Boxed: Story = {
  name: 'shows the command palette shortcut in a boxed key style',
  args: {
    variant: 'boxed',
    children: '⌘K',
  },
}
