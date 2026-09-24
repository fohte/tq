import type { Meta, StoryObj } from '@storybook/react-vite'

import { SearchSyntaxHelpPopover } from '#components/search/search-syntax-help-popover'

const meta = {
  title: 'Search/SearchSyntaxHelpPopover',
  component: SearchSyntaxHelpPopover,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof SearchSyntaxHelpPopover>

export default meta
type Story = StoryObj<typeof meta>

export const Closed: Story = {}

export const Open: Story = {
  args: { defaultOpen: true },
}
