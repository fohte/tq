import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { ScheduleConstraintsField } from '#components/schedule/schedule-constraints-field'
import { scheduleConstraintFormStateFromSaved } from '#components/schedule/schedule-constraints-form-state'
import { makeScheduleConstraint } from '#components/schedule/schedule-test-fixtures'

const configuredConstraints = scheduleConstraintFormStateFromSaved(
  makeScheduleConstraint(),
)

const meta = {
  title: 'Schedule/ScheduleConstraintsField',
  component: ScheduleConstraintsField,
  decorators: [
    (Story) => (
      <div className="dark min-h-64 bg-background p-6">
        <Story />
      </div>
    ),
  ],
  args: {
    variant: 'desktop',
    value: configuredConstraints,
    isLoading: false,
    isError: false,
    saveError: false,
    scheduleSaveAfterConstraintsError: false,
    isPending: false,
    defaultOpen: false,
    onAdd: fn(),
    onChange: fn(),
    onRemove: fn(),
  },
} satisfies Meta<typeof ScheduleConstraintsField>

export default meta
type Story = StoryObj<typeof meta>

export const DesktopEditor: Story = {
  name: 'the desktop editor shows weekly limits and weekday rules',
}

export const DesktopWithoutConstraints: Story = {
  name: 'the desktop editor offers a button when no constraints are saved',
  args: { value: null },
}

export const MobileSummary: Story = {
  name: 'the mobile editor summarizes saved constraints in a chip',
  args: { variant: 'mobile' },
}

export const MobileWithoutConstraints: Story = {
  name: 'the mobile editor offers a button when no constraints are saved',
  args: { variant: 'mobile', value: null },
}

export const MobileEditorExpanded: Story = {
  name: 'the mobile chip expands to show the constraint fields',
  args: { variant: 'mobile', defaultOpen: true },
}

export const Loading: Story = {
  name: 'the editor shows a loading message while constraints load',
  args: { isLoading: true },
}

export const Unavailable: Story = {
  name: 'the editor explains when constraints could not be loaded',
  args: { isError: true },
}

export const Saving: Story = {
  name: 'the editor disables its controls while constraints save',
  args: { isPending: true },
}

export const SaveFailed: Story = {
  name: 'the editor shows an error when saving constraints fails',
  args: { saveError: true },
}

export const ScheduleSaveFailed: Story = {
  name: 'the editor explains that constraints saved before schedule changes failed',
  args: { scheduleSaveAfterConstraintsError: true },
}
