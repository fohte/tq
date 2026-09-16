import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { GcalCalendarPicker } from '#components/settings/gcal-calendar-picker'
import { makeGcalCalendar } from '#components/settings/gcal-calendar-test-fixtures'
import type { IntegrationAccountView } from '#components/settings/integration-card'
import { Panel } from '#components/ui/panel'
import { type GcalCalendar, gcalCalendarsKeys } from '#hooks/use-gcal-calendars'

const account: IntegrationAccountView = {
  id: 'token-1',
  label: 'fohte@example.com',
}

const sampleCalendars: GcalCalendar[] = [
  makeGcalCalendar(),
  makeGcalCalendar({
    id: 'work-calendar-id',
    displayName: 'Work',
    color: '#039BE5',
    primary: false,
    subscribed: false,
  }),
]

function Providers({
  children,
  calendars = sampleCalendars,
}: {
  children: ReactNode
  calendars?: GcalCalendar[] | undefined
}) {
  const queryClient = new QueryClient({
    // staleTime: Infinity keeps the seeded data from being considered stale,
    // so enabling the query (clicking to expand) never triggers a background
    // refetch that a story — which can't register an MSW handler via play —
    // would leave unhandled.
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  queryClient.setQueryData(gcalCalendarsKeys.list(account.id), calendars)

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

function WrappedGcalCalendarPicker(props: {
  calendars?: GcalCalendar[]
  initialOpen?: boolean
}) {
  return (
    <Providers calendars={props.calendars}>
      <Panel className="w-72 p-3">
        <GcalCalendarPicker
          account={account}
          initialOpen={props.initialOpen ?? false}
        />
      </Panel>
    </Providers>
  )
}

const meta = {
  title: 'Settings/GcalCalendarPicker',
  component: WrappedGcalCalendarPicker,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof WrappedGcalCalendarPicker>

export default meta
type Story = StoryObj<typeof meta>

export const Collapsed: Story = {
  args: {},
}

export const Expanded: Story = {
  args: {
    initialOpen: true,
  },
}
