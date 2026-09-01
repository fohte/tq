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
    onValueChange: fn(),
  },
} satisfies Meta<typeof TaskStatusPicker>

export default meta
type Story = StoryObj<typeof meta>

export const Todo: Story = {
  args: {
    status: 'todo',
    statusReason: null,
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
    await expect(
      body.getByRole('menuitemradio', { name: 'Not planned' }),
    ).toBeInTheDocument()
    await expect(
      body.getByRole('menuitemradio', { name: 'Duplicate' }),
    ).toBeInTheDocument()

    await userEvent.click(
      body.getByRole('menuitemradio', { name: 'Completed' }),
    )
    // Base UI's RadioGroup passes a second `eventDetails` argument alongside the value
    await expect(args.onValueChange).toHaveBeenCalledWith(
      'completed',
      expect.anything(),
    )
  },
}

export const Completed: Story = {
  args: {
    status: 'completed',
    statusReason: null,
  },
}

export const NotPlannedOpen: Story = {
  args: {
    status: 'completed',
    statusReason: 'not_planned',
  },
  play: async ({ canvasElement, userEvent }) => {
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(body.getByLabelText('Change task status'))
    await expect(
      await body.findByRole('menuitemradio', { name: 'Not planned' }),
    ).toHaveAttribute('aria-checked', 'true')
  },
}

export const DuplicateOpen: Story = {
  args: {
    status: 'completed',
    statusReason: 'duplicate',
  },
  play: async ({ canvasElement, userEvent }) => {
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(body.getByLabelText('Change task status'))
    await expect(
      await body.findByRole('menuitemradio', { name: 'Duplicate' }),
    ).toHaveAttribute('aria-checked', 'true')
  },
}
