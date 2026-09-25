import type { Meta, StoryObj } from '@storybook/react-vite'

import { getSearchSyntaxHelpSections } from '#components/search/search-syntax-help-data'
import { SearchSyntaxHelpPanel } from '#components/search/search-syntax-help-panel'

const meta = {
  title: 'Search/SearchSyntaxHelpPanel',
  component: SearchSyntaxHelpPanel,
  args: {
    sections: getSearchSyntaxHelpSections(),
  },
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div className="w-88 bg-popover text-popover-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SearchSyntaxHelpPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithBackButton: Story = {
  args: { onBack: () => undefined },
}

export const TaskFilterHelp: Story = {
  args: {
    sections: getSearchSyntaxHelpSections({ audience: 'task-filter' }),
    showFilterIcons: true,
  },
}
