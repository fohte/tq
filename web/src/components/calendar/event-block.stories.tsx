import type { Meta, StoryObj } from '@storybook/react-vite'
import type { TimeBlockEvent } from '@web/components/calendar/calendar-view'
import { EventBlock } from '@web/components/calendar/event-block'

type EventType = TimeBlockEvent['type']

function EventBlockPreview({
  type = 'manual',
  title = 'API ドキュメント作成',
  timeText = '09:00 - 10:00',
  duration,
  parentRef,
  label,
  color,
}: {
  type?: EventType
  title?: string
  timeText?: string
  duration?: string
  parentRef?: string
  label?: string
  color?: { bg: string; accent: string }
}) {
  const arg = {
    event: {
      title,
      extendedProps: { type, duration, parentRef, label, color },
    },
    timeText,
  }

  return (
    <div className="w-72">
      <div className="h-20">
        {/* eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- story mock data doesn't match full EventContentArg */}
        <EventBlock {...(arg as unknown as Parameters<typeof EventBlock>[0])} />
      </div>
    </div>
  )
}

const meta = {
  title: 'Calendar/EventBlock',
  component: EventBlockPreview,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    type: {
      control: 'select',
      options: [
        'manual',
        'auto',
        'gcal',
        'completed',
        'schedule',
      ] satisfies EventType[],
    },
  },
} satisfies Meta<typeof EventBlockPreview>

export default meta
type Story = StoryObj<typeof meta>

export const Manual: Story = {
  args: {
    type: 'manual',
    title: 'API ドキュメント作成',
    timeText: '09:00 - 10:00',
    duration: '1h',
    label: 'dev:tq',
  },
}

export const ManualWithParent: Story = {
  args: {
    type: 'manual',
    title: 'テスト追加',
    timeText: '10:30 - 11:30',
    duration: '1h',
    parentRef: '#488 tq 作成',
  },
}

export const AutoScheduled: Story = {
  args: {
    type: 'auto',
    title: 'コードレビュー',
    timeText: '13:00 - 13:45',
    duration: '45m',
  },
}

export const GoogleCalendar: Story = {
  args: {
    type: 'gcal',
    title: 'Team standup',
    timeText: '11:00 - 11:30',
  },
}

export const Completed: Story = {
  args: {
    type: 'completed',
    title: 'CI パイプライン構築',
    timeText: '14:00 - 15:00',
    duration: '1h',
  },
}

export const SchedulePurple: Story = {
  args: {
    type: 'schedule',
    title: 'Sleep',
    timeText: '23:00 - 07:00',
    color: { bg: '#2D2B55', accent: '#6C63FF' },
  },
}

export const ScheduleGreen: Story = {
  args: {
    type: 'schedule',
    title: 'Gym',
    timeText: '07:00 - 08:00',
    color: { bg: '#1B4332', accent: '#52B788' },
  },
}
