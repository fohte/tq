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

export const Default: Story = {
  name: 'the search footer shows its keyboard shortcuts',
}

export const RemoveScope: Story = {
  name: 'the search footer offers a shortcut to remove the last scope',
  args: { canPopScope: true },
}

export const ClearContext: Story = {
  name: 'the search footer offers a shortcut to clear the context',
  args: { canClearContext: true },
}

export const HelpOpen: Story = {
  name: 'the search footer shows how to close the open syntax guide',
  args: { isHelpOpen: true },
}

export const HelpUnavailableWithQuery: Story = {
  name: 'the search footer hides the help shortcut while a query is active',
  args: { canOpenHelp: false },
}
