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

export const CreationFailed: Story = {
  name: 'the dialog explains that the occurrence could not be created',
  args: {
    error: 'Failed to add the task.',
  },
}

export const Submitting: Story = {
  name: 'the dialog prevents changes while creating an occurrence',
  args: {
    isPending: true,
  },
}

export const MissingDate: Story = {
  name: 'the dialog disables adding when no occurrence date is selected',
  args: {
    occurrenceDate: '',
  },
}
