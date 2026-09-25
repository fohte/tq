import type { Meta, StoryObj } from '@storybook/react-vite'

import { SearchModalInput } from '#components/search/search-modal-input'

const meta = {
  title: 'Search/SearchModalInput',
  component: SearchModalInput,
  args: {
    searchScopes: [],
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

export const Default: Story = {
  name: 'the search input is empty and ready for a query',
}

export const ScopedAndLoading: Story = {
  name: 'the search input shows task scopes while results are loading',
  tags: ['desktop-only'],
  args: {
    modePrefix: '#',
    context: 'work',
    searchScopes: [
      { token: 'project:<project-id>', label: 'project:Quarterly planning' },
      { token: 'parent:<task-id>', label: 'parent:#42 Prepare release' },
    ],
    searchInputValue: 'schedule',
    isFetching: true,
  },
}
