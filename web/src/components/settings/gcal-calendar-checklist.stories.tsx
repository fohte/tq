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
  },
  {
    id: 'work-calendar-id',
    displayName: 'Work',
    color: '#039BE5',
    primary: false,
    subscribed: true,
  },
  {
    id: 'holidays-id',
    displayName: '日本の祝日',
    color: '#33B679',
    primary: false,
    subscribed: false,
  },
]

const meta = {
  title: 'Settings/GcalCalendarChecklist',
  component: GcalCalendarChecklist,
  parameters: {
    layout: 'centered',
    // Checkbox's hit-slop pseudo-element overflows its own box on purpose —
    // see checkbox.stories.tsx for the same exemption.
    overflowCheck: { ignoreSelectors: ['[data-slot="checkbox"]'] },
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
  args: {
    calendars: sampleCalendars,
    onToggle: () => {},
  },
}

export const Updating: Story = {
  args: {
    calendars: sampleCalendars,
    onToggle: () => {},
    updatingCalendarId: 'work-calendar-id',
  },
}

export const Empty: Story = {
  args: {
    calendars: [],
    onToggle: () => {},
  },
}
