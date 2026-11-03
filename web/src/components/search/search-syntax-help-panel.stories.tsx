import type { Meta, StoryObj } from '@storybook/react-vite'

import { getSearchSyntaxHelpSections } from '#components/search/search-syntax-help-data'
import { SearchSyntaxHelpPanel } from '#components/search/search-syntax-help-panel'
import { makePrioritySettings } from '#components/task/priority-settings-test-fixtures'

const meta = {
  title: 'Search/SearchSyntaxHelpPanel',
  component: SearchSyntaxHelpPanel,
  args: {
    sections: getSearchSyntaxHelpSections({
      prioritySettings: makePrioritySettings(),
    }),
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

export const Default: Story = {
  name: 'the syntax guide lists search targets and available filters',
}

export const WithBackButton: Story = {
  name: 'the syntax guide shows a back button above its filter examples',
  args: { onBack: () => undefined },
}

export const TaskFilterHelp: Story = {
  name: 'the task filter syntax guide shows only supported filters',
  args: {
    sections: getSearchSyntaxHelpSections({
      audience: 'task-filter',
      prioritySettings: makePrioritySettings(),
    }),
    showFilterIcons: true,
  },
}
