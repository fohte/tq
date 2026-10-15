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
      <div className="flex h-12 w-full max-w-160 items-center gap-2 border border-border bg-popover px-3 text-popover-foreground">
        <span className="shrink-0 font-mono text-sm font-bold text-primary">
          ›
        </span>
        <Story />
        <span className="min-w-0 flex-1 font-mono text-sm text-muted-foreground">
          search terms
        </span>
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
