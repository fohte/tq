import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { expect, within } from 'storybook/test'

import { GcalCalendarPicker } from '#components/settings/gcal-calendar-picker'
import type { IntegrationAccountView } from '#components/settings/integration-card'
import { Panel } from '#components/ui/panel'
import { type GcalCalendar, gcalCalendarsKeys } from '#hooks/use-gcal-calendars'

const account: IntegrationAccountView = {
  id: 'token-1',
  label: 'fohte@example.com',
}

const sampleCalendars: GcalCalendar[] = [
  {
    id: 'fohte@example.com',
    displayName: 'fohte@example.com',
    color: '#D50000',
    primary: true,
    subscribed: true,
  },
  {
    id: 'work-calendar-id',
    displayName: 'Work',
    color: '#039BE5',
    primary: false,
    subscribed: false,
  },
]

function Providers({
  children,
  calendars = sampleCalendars,
}: {
  children: ReactNode
  calendars?: GcalCalendar[] | undefined
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  queryClient.setQueryData(gcalCalendarsKeys.list(account.id), calendars)

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

function WrappedGcalCalendarPicker(props: { calendars?: GcalCalendar[] }) {
  return (
    <Providers calendars={props.calendars}>
      <Panel className="w-72 p-3">
        <GcalCalendarPicker account={account} />
      </Panel>
    </Providers>
  )
}

const meta = {
  title: 'Settings/GcalCalendarPicker',
  component: WrappedGcalCalendarPicker,
  parameters: {
    layout: 'centered',
    // Opening the picker flips `useGcalCalendarsList`'s `enabled` from false
    // to true, which refetches in the background even though the data is
    // already seeded into the query cache.
    msw: {
      handlers: [
        http.get('/api/calendar/accounts/:accountId/calendars', () =>
          HttpResponse.json(sampleCalendars),
        ),
      ],
    },
  },
} satisfies Meta<typeof WrappedGcalCalendarPicker>

export default meta
type Story = StoryObj<typeof meta>

export const Collapsed: Story = {
  args: {},
}

export const Expanded: Story = {
  args: {},
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      canvas.getByRole('button', { name: 'カレンダーを選択' }),
    )
    await expect(canvas.getByText('Work')).toBeVisible()
  },
}
