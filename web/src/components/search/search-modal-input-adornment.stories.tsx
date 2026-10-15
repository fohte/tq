import type { Meta, StoryObj } from '@storybook/react-vite'

import { SearchModalInputAdornment } from '#components/search/search-modal-input-adornment'

const meta = {
  title: 'Search/SearchModalInputAdornment',
  component: SearchModalInputAdornment,
  args: {
    searchScopes: [],
    onRemoveContext: () => undefined,
    onRemoveScopeToken: () => undefined,
  },
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div className="flex items-center gap-2">
        <Story />
        <span>search terms</span>
      </div>
    ),
  ],
} satisfies Meta<typeof SearchModalInputAdornment>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'the input has no active search scopes',
}

export const ScopedAndContextual: Story = {
  name: 'the input shows a context and task scopes',
  tags: ['desktop-only'],
  args: {
    context: 'work',
    searchScopes: [
      { token: 'project:<project-id>', label: 'project:Sample roadmap' },
      { token: 'parent:<task-id>', label: 'parent:#12 Prepare release' },
    ],
  },
}
