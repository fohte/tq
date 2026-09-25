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
    onRemoveContext: () => undefined,
    onRemoveScopeToken: () => undefined,
  },
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div className="w-full max-w-160 bg-popover text-popover-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SearchModalInput>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const ScopedAndLoading: Story = {
  tags: ['desktop-only'],
  args: {
    modePrefix: '#',
    context: 'work',
    searchScopeTokens: [
      { token: 'project:<project-id>', label: 'project: Quarterly planning' },
      { token: 'parent:<task-id>', label: 'parent:#42 Prepare release' },
    ],
    searchInputValue: 'schedule',
    isFetching: true,
  },
}
