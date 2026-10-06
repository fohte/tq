import type { Meta, StoryObj } from '@storybook/react-vite'

import { KeybindHint } from '#components/ui/keybind-hint'

const meta = {
  title: 'UI/KeybindHint',
  component: KeybindHint,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['plain', 'strong', 'muted', 'boxed'],
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

export const PlainBright: Story = {
  name: 'shows a brighter shortcut for the command palette',
  args: {
    variant: 'strong',
    children: '⌘K',
  },
}

export const PlainMuted: Story = {
  name: 'shows a muted shortcut in a button label',
  args: {
    variant: 'muted',
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
