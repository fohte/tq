import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { SchedulingSettingsPanel } from '#components/settings/scheduling-settings-panel'
import type { SchedulingSettings } from '#hooks/use-scheduling-settings'

const sampleSettings: SchedulingSettings = {
  workingHoursStart: '09:00',
  workingHoursEnd: '19:00',
  minimumBlockMinutes: 30,
  autoRescheduleOnGcalChange: true,
  defaultContext: 'personal',
  updatedAt: '2026-01-01T00:00:00.000Z',
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
      <div className="w-[560px]">
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
// the component in its initial isLoading render.
export const Loading: Story = {
  args: {},
}

export const Default: Story = {
  args: {
    settings: sampleSettings,
  },
}

export const WorkContext: Story = {
  args: {
    settings: { ...sampleSettings, defaultContext: 'work' },
  },
}

export const RescheduleDisabled: Story = {
  args: {
    settings: { ...sampleSettings, autoRescheduleOnGcalChange: false },
  },
}
