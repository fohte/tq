import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'

import type { PlanValue } from '#components/task/create-task-modal-fields'
import { PlanTabStrip } from '#components/task/plan-tab-strip'

function PlanTabStripDemo({
  onChange,
  disabled,
}: {
  onChange: (value: PlanValue | '') => void
  disabled?: boolean
}) {
  const [value, setValue] = useState<PlanValue | ''>('')

  return (
    <PlanTabStrip
      value={value}
      onChange={(next) => {
        setValue(next)
        onChange(next)
      }}
      {...(disabled != null ? { disabled } : {})}
    />
  )
}

const meta = {
  title: 'Task/PlanTabStrip',
  component: PlanTabStripDemo,
  parameters: {
    layout: 'centered',
  },
  args: {
    onChange: fn(),
  },
} satisfies Meta<typeof PlanTabStripDemo>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const SelectsToday: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByText('today'))
    await expect(args.onChange).toHaveBeenCalledWith('day')
    await expect(canvas.getByText('today')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  },
}

export const SelectsThisWeek: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByText('this week'))
    await expect(args.onChange).toHaveBeenCalledWith('week')
    await expect(canvas.getByText('this week')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  },
}

export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByText('today'))
    await expect(args.onChange).not.toHaveBeenCalled()
    await expect(canvas.getByText('today')).toBeDisabled()
  },
}
