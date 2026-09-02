import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { delay, http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'

import { SchedulingSettingsPanel } from '#components/settings/scheduling-settings-panel'
import type { SchedulingSettings } from '#hooks/use-scheduling-settings'

const sampleSettings: SchedulingSettings = {
  workingHoursStart: '09:00',
  workingHoursEnd: '19:00',
  minimumBlockMinutes: 30,
  autoRescheduleOnGcalChange: true,
  updatedAt: '2026-01-01T00:00:00.000Z',
}

function settingsHandler(settings: SchedulingSettings) {
  return http.get('/api/scheduling-settings', () => HttpResponse.json(settings))
}

function Providers({
  children,
  settings,
}: {
  children: ReactNode
  settings?: SchedulingSettings | undefined
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  if (settings !== undefined) {
    queryClient.setQueryData(['scheduling-settings'], settings)
  }

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

function WrappedSchedulingSettingsPanel(props: {
  settings?: SchedulingSettings | undefined
}) {
  return (
    <Providers settings={props.settings}>
      <div className="w-full max-w-3xl">
        <SchedulingSettingsPanel />
      </div>
    </Providers>
  )
}

const meta = {
  title: 'Settings/SchedulingSettingsPanel',
  component: WrappedSchedulingSettingsPanel,
} satisfies Meta<typeof WrappedSchedulingSettingsPanel>

export default meta
type Story = StoryObj<typeof meta>

// settings left undefined so the query never gets a cached value, keeping
// the component in its initial isLoading render. The settings request is
// held open (rather than errored) so the loading state stays visible.
export const Loading: Story = {
  args: {},
  parameters: {
    msw: {
      handlers: [
        http.get('/api/scheduling-settings', async () => {
          await delay('infinite')
          return HttpResponse.json(sampleSettings)
        }),
      ],
    },
  },
}

export const Default: Story = {
  args: {
    settings: sampleSettings,
  },
  parameters: {
    msw: {
      handlers: [settingsHandler(sampleSettings)],
    },
  },
}

export const RescheduleDisabled: Story = {
  args: {
    settings: { ...sampleSettings, autoRescheduleOnGcalChange: false },
  },
  parameters: {
    msw: {
      handlers: [
        settingsHandler({
          ...sampleSettings,
          autoRescheduleOnGcalChange: false,
        }),
      ],
    },
  },
}
