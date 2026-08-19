import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useState } from 'react'

import { SearchModal } from '#components/search/search-modal'
import { StoryRouter } from '#storybook-config/story-router'

function Providers({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>
      <StoryRouter
        component={() => <>{children}</>}
        paths={['/tasks/$taskId']}
      />
    </QueryClientProvider>
  )
}

function SearchModalStory() {
  const [open, setOpen] = useState(true)
  return (
    <Providers>
      <div className="flex h-screen items-center justify-center bg-background">
        <button
          type="button"
          onClick={() => {
            setOpen(true)
          }}
          className="border border-border bg-secondary px-4 py-2 font-mono text-sm text-foreground"
        >
          Open Search (Cmd+K)
        </button>
        <SearchModal open={open} onOpenChange={setOpen} />
      </div>
    </Providers>
  )
}

const meta = {
  title: 'Search/SearchModal',
  component: SearchModalStory,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof SearchModalStory>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
