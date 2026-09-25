import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { SaveViewButton } from '#components/saved-view/save-view-button'

const meta = {
  title: 'SavedView/SaveViewButton',
  component: SaveViewButton,
  decorators: [
    (Story) => (
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: { queries: { retry: false, staleTime: Infinity } },
          })
        }
      >
        <Story />
      </QueryClientProvider>
    ),
  ],
  args: {
    query: 'is:todo sort:updated',
  },
} satisfies Meta<typeof SaveViewButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'the saved view button offers to save the current search',
}

export const DialogOpen: Story = {
  name: 'the saved view button shows its save dialog open',
  args: {
    initialOpen: true,
  },
}
