import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent } from 'storybook/test'

import { TaskStatusFilterFields } from '#components/task/task-status-filter-fields'

const meta = {
  title: 'Task/TaskStatusFilterFields',
  component: TaskStatusFilterFields,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div className="w-64 p-4">
        <Story />
      </div>
    ),
  ],
  args: {
    status: ['todo'],
    onStatusChange: fn(),
  },
} satisfies Meta<typeof TaskStatusFilterFields>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const NoneSelected: Story = {
  args: {
    status: [],
  },
}

export const AllSelected: Story = {
  args: {
    status: ['todo', 'completed'],
  },
}

export const CheckCompleted: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole('checkbox', { name: 'Completed' }))
    await expect(args.onStatusChange).toHaveBeenCalledWith([
      'todo',
      'completed',
    ])
  },
}

// Unchecking one of two checked boxes leaves the other checked — the
// single-checked case (where the last box is disabled instead) is covered
// by SingleSelected/CannotUncheckLastStatus below.
export const UncheckTodo: Story = {
  args: {
    status: ['todo', 'completed'],
  },
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole('checkbox', { name: 'Todo' }))
    await expect(args.onStatusChange).toHaveBeenCalledWith(['completed'])
  },
}

// Unchecking the last remaining status would silently mean "show
// everything" (no is: tokens at all) rather than "show nothing" — so the
// sole checked box is disabled instead of lying about being clickable.
export const SingleSelected: Story = {
  args: {
    status: ['todo'],
  },
}

export const CannotUncheckLastStatus: Story = {
  args: {
    status: ['todo'],
  },
  parameters: {
    // Same status args as SingleSelected, and the click on the disabled
    // checkbox is a no-op — the play only proves onStatusChange isn't
    // called, not a distinct look.
    screenshot: { skip: true },
  },
  play: async ({ canvas, args }) => {
    // The checkbox is a Base UI `<span role="checkbox">`, not a native
    // form control, so `disabled` only ever surfaces as `aria-disabled`
    // (jest-dom's toBeDisabled() only recognizes native disabled form
    // elements and would report false negatives here).
    await expect(
      canvas.getByRole('checkbox', { name: 'Todo' }),
    ).toHaveAttribute('aria-disabled', 'true')
    await userEvent.click(canvas.getByRole('checkbox', { name: 'Todo' }))
    await expect(args.onStatusChange).not.toHaveBeenCalled()
  },
}
