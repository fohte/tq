import type { Meta, StoryObj } from '@storybook/react-vite'

import { GcalCalendarChecklist } from '#components/settings/gcal-calendar-checklist'
import { Panel } from '#components/ui/panel'
import type { GcalCalendar } from '#hooks/use-gcal-calendars'

const sampleCalendars: GcalCalendar[] = [
  {
    id: 'fohte@example.com',
    displayName: 'fohte@example.com',
    color: '#D50000',
    primary: true,
    subscribed: true,
    context: 'personal',
  },
  {
    id: 'work-calendar-id',
    displayName: 'Work',
    color: '#039BE5',
    primary: false,
    subscribed: true,
    context: 'work',
  },
  {
    id: 'holidays-id',
    displayName: '日本の祝日',
    color: '#33B679',
    primary: false,
    subscribed: false,
    context: null,
  },
]

const meta = {
  title: 'Settings/GcalCalendarChecklist',
  component: GcalCalendarChecklist,
  parameters: {
    layout: 'centered',
  },
  render: (args) => (
    <Panel className="w-72 p-3">
      <GcalCalendarChecklist {...args} />
    </Panel>
  ),
} satisfies Meta<typeof GcalCalendarChecklist>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'the calendar checklist shows enabled calendars and their contexts',
  args: {
    calendars: sampleCalendars,
    onToggle: () => {},
    onContextChange: () => {},
  },
}

export const Updating: Story = {
  name: 'the calendar checklist marks one calendar while its setting updates',
  args: {
    calendars: sampleCalendars,
    onToggle: () => {},
    onContextChange: () => {},
    updatingCalendarId: 'work-calendar-id',
  },
}

export const UpdatingContext: Story = {
  name: 'the calendar checklist marks a context while it updates',
  args: {
    calendars: sampleCalendars,
    onToggle: () => {},
    onContextChange: () => {},
    updatingContextCalendarId: 'work-calendar-id',
  },
}

export const Empty: Story = {
  name: 'the calendar checklist explains that no calendars are available',
  args: {
    calendars: [],
    onToggle: () => {},
    onContextChange: () => {},
  },
}
