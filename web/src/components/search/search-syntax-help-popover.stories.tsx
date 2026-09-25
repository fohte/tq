import type { Meta, StoryObj } from '@storybook/react-vite'

import { SearchSyntaxHelpPopover } from '#components/search/search-syntax-help-popover'

const meta = {
  title: 'Search/SearchSyntaxHelpPopover',
  component: SearchSyntaxHelpPopover,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof SearchSyntaxHelpPopover>

export default meta
type Story = StoryObj<typeof meta>

export const Closed: Story = {
  name: 'the syntax help popover is closed beside the search controls',
}

export const Open: Story = {
  name: 'the syntax help popover displays search targets and filters',
  args: { defaultOpen: true },
}
