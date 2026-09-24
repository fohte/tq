import type { Meta, StoryObj } from '@storybook/react-vite'

import { SearchModalFooter } from '#components/search/search-modal-footer'

const meta = {
  title: 'Search/SearchModalFooter',
  component: SearchModalFooter,
  args: {
    canClearContext: false,
    canPopScope: false,
    canOpenHelp: true,
    isHelpOpen: false,
  },
  parameters: { layout: 'centered' },
} satisfies Meta<typeof SearchModalFooter>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const RemoveScope: Story = {
  args: { canPopScope: true },
}

export const ClearContext: Story = {
  args: { canClearContext: true },
}

export const HelpOpen: Story = {
  args: { isHelpOpen: true },
}

export const HelpUnavailableWithQuery: Story = {
  args: { canOpenHelp: false },
}
