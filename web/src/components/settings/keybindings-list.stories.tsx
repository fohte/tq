import type { Meta, StoryObj } from '@storybook/react-vite'

import { KeybindingsList } from '#components/settings/keybindings-list'
import { getSearchKeybinding } from '#lib/keybindings'

const meta = {
  title: 'Settings/KeybindingsList',
  component: KeybindingsList,
} satisfies Meta<typeof KeybindingsList>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'the keyboard shortcuts panel shows Cmd+K on macOS',
  args: {
    searchKeybinding: getSearchKeybinding('MacIntel'),
  },
}

export const NonMacOS: Story = {
  name: 'the keyboard shortcuts panel shows Ctrl+K on non-Mac platforms',
  args: {
    searchKeybinding: getSearchKeybinding('Linux x86_64'),
  },
}
