import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  CalendarHeader,
  type CalendarViewType,
} from '@web/components/calendar/calendar-header'
import { useState } from 'react'
import { expect, fn } from 'storybook/test'

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

type InteractionTestStory = StoryObj<{
  currentDate: Date
  activeView: CalendarViewType
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  onViewChange: (view: CalendarViewType) => void
}>

export const InteractionTest: InteractionTestStory = {
  args: {
    currentDate: new Date(2025, 2, 7),
    activeView: 'day',
    onPrev: fn(),
    onNext: fn(),
    onToday: fn(),
    onViewChange: fn(),
  },
  render: (args) => (
    <div className="w-[600px]">
      <CalendarHeader {...args} />
    </div>
  ),
  play: async ({ canvas, args, userEvent }) => {
    // Displays the formatted date with day of week
    // findByText polls, unlike getByText, so this doesn't race the initial React commit
    await expect(await canvas.findByText(/March 7, 2025/)).toBeVisible()
    await expect(canvas.getByText(/Fri/)).toBeVisible()

    // Renders all three view options
    await expect(canvas.getByText('Day')).toBeVisible()
    await expect(canvas.getByText('Week')).toBeVisible()
    await expect(canvas.getByText('Month')).toBeVisible()

    // Calls onPrev when previous button is clicked
    await userEvent.click(canvas.getByLabelText('Previous'))
    await expect(args.onPrev).toHaveBeenCalledOnce()

    // Calls onNext when next button is clicked
    await userEvent.click(canvas.getByLabelText('Next'))
    await expect(args.onNext).toHaveBeenCalledOnce()

    // Calls onToday when Today button is clicked
    await userEvent.click(canvas.getByText('Today'))
    await expect(args.onToday).toHaveBeenCalledOnce()

    // Calls onViewChange when a view button is clicked
    await userEvent.click(canvas.getByText('Month'))
    await expect(args.onViewChange).toHaveBeenCalledWith('month')

    // Highlights the active view (Day is active)
    const dayButton = canvas.getByText('Day')
    await expect(dayButton.className).toContain('bg-background')
  },
}
