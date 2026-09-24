import type { Meta, StoryObj } from '@storybook/react-vite'

import { SearchModalInput } from '#components/search/search-modal-input'

const meta = {
  title: 'Search/SearchModalInput',
  component: SearchModalInput,
  args: {
    searchScopeTokens: [],
    searchInputValue: '',
    searchTarget: 'tasks',
    isFetching: false,
    onInputValueChange: () => undefined,
  },
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div className="w-full max-w-160 overflow-hidden bg-popover text-popover-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SearchModalInput>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const ScopedAndLoading: Story = {
  args: {
    modePrefix: '#',
    context: 'work',
    searchScopeTokens: ['project:<project-id>', 'parent:<task-id>'],
    searchInputValue: 'schedule',
    isFetching: true,
  },
}
