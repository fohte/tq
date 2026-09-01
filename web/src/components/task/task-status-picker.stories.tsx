import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'

import { TaskStatusPicker } from '#components/task/task-status-picker'

const meta = {
  title: 'Task/TaskStatusPicker',
  component: TaskStatusPicker,
  parameters: {
    layout: 'centered',
  },
  args: {
    onStatusChange: fn(),
  },
} satisfies Meta<typeof TaskStatusPicker>

export default meta
type Story = StoryObj<typeof meta>

export const Todo: Story = {
  args: {
    status: 'todo',
  },
  play: async ({ canvasElement, args, userEvent }) => {
    // Menu renders via portal, so query the entire document body
    const body = within(canvasElement.ownerDocument.body)

    await userEvent.click(body.getByLabelText('Change task status'))

    await expect(
      await body.findByRole('menuitemradio', { name: 'Todo' }),
    ).toBeInTheDocument()
    await expect(
      body.getByRole('menuitemradio', { name: 'Completed' }),
    ).toBeInTheDocument()

    await userEvent.click(
      body.getByRole('menuitemradio', { name: 'Completed' }),
    )
    // Base UI's RadioGroup passes a second `eventDetails` argument alongside the value
    await expect(args.onStatusChange).toHaveBeenCalledWith(
      'completed',
      expect.anything(),
    )
  },
}

export const Completed: Story = {
  args: {
    status: 'completed',
  },
}
