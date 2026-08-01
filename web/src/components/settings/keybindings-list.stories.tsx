import type { Meta, StoryObj } from '@storybook/react-vite'

import { KeybindingsList } from '#components/settings/keybindings-list'

const meta = {
  title: 'Settings/KeybindingsList',
  component: KeybindingsList,
} satisfies Meta<typeof KeybindingsList>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
