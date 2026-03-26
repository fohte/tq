import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  CalendarHeader,
  type CalendarViewType,
} from '@web/components/calendar/calendar-header'
import { useState } from 'react'

function CalendarHeaderStateful({
  initialDate,
  initialView = 'day',
}: {
  initialDate?: Date
  initialView?: CalendarViewType
}) {
  const [currentDate, setCurrentDate] = useState(
    initialDate ?? new Date(2025, 2, 7),
  )
  const [activeView, setActiveView] = useState<CalendarViewType>(initialView)

  return (
    <div className="w-[600px]">
      <CalendarHeader
        currentDate={currentDate}
        activeView={activeView}
        onPrev={() => {
          setCurrentDate((d) => {
            const newDate = new Date(d)
            newDate.setDate(newDate.getDate() - 1)
            return newDate
          })
        }}
        onNext={() => {
          setCurrentDate((d) => {
            const newDate = new Date(d)
            newDate.setDate(newDate.getDate() + 1)
            return newDate
          })
        }}
        onToday={() => {
          setCurrentDate(new Date())
        }}
        onViewChange={setActiveView}
      />
    </div>
  )
}

const meta = {
  title: 'Calendar/CalendarHeader',
  component: CalendarHeaderStateful,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof CalendarHeaderStateful>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {},
}

export const WeekView: Story = {
  args: {
    initialView: 'week',
  },
}

export const MonthView: Story = {
  args: {
    initialView: 'month',
  },
}
