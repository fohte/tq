import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { AddRecurringOccurrenceDialog } from '#components/recurring/add-recurring-occurrence-dialog'

const meta = {
  title: 'Recurring/AddRecurringOccurrenceDialog',
  component: AddRecurringOccurrenceDialog,
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    open: true,
    onOpenChange: fn(),
    occurrenceDate: '2026-03-20',
    onOccurrenceDateChange: fn(),
    isPending: false,
    error: null,
    onSubmit: fn(),
  },
} satisfies Meta<typeof AddRecurringOccurrenceDialog>

export default meta
type Story = StoryObj<typeof meta>

export const ReadyToAdd: Story = {
  name: 'the dialog is ready to add an occurrence for the selected date',
}

export const DateAlreadyExists: Story = {
  name: 'the dialog explains that the selected date already has an occurrence',
  args: {
    error: 'A task for 2026-03-20 already exists.',
  },
}
