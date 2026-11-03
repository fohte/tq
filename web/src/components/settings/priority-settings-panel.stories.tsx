import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { delay, http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'

import { PrioritySettingsPanel } from '#components/settings/priority-settings-panel'
import { makePrioritySettings } from '#components/task/priority-settings-test-fixtures'

function Providers({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

function WrappedPrioritySettingsPanel() {
  return (
    <Providers>
      <div className="w-full max-w-3xl">
        <PrioritySettingsPanel />
      </div>
    </Providers>
  )
}

const meta = {
  title: 'Settings/PrioritySettingsPanel',
  component: WrappedPrioritySettingsPanel,
} satisfies Meta<typeof WrappedPrioritySettingsPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'the priority settings show all five configurable stages',
  parameters: {
    msw: {
      handlers: [
        http.get('/api/priority-settings', () =>
          HttpResponse.json(makePrioritySettings()),
        ),
      ],
    },
  },
}

export const Loading: Story = {
  name: 'the priority settings show a loading message',
  parameters: {
    msw: {
      handlers: [
        http.get('/api/priority-settings', async () => {
          await delay('infinite')
          return HttpResponse.json([])
        }),
      ],
    },
  },
}
