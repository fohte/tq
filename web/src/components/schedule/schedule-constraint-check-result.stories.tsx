import type { Meta, StoryObj } from '@storybook/react-vite'

import { ScheduleConstraintCheckResult } from '#components/schedule/schedule-constraint-check-result'
import { makeScheduleConstraintViolations } from '#components/schedule/schedule-test-fixtures'

const sampleViolations = makeScheduleConstraintViolations()

const meta = {
  title: 'Schedule/ScheduleConstraintCheckResult',
  component: ScheduleConstraintCheckResult,
  args: {
    occurrenceDate: '2041-05-15',
    constraintViolations: [],
    isLoading: false,
    isError: false,
    isIncomplete: false,
    draftInvalid: false,
  },
  decorators: [
    (Story) => (
      <div className="dark min-h-48 max-w-xl bg-background p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ScheduleConstraintCheckResult>

export default meta
type Story = StoryObj<typeof meta>

export const AllConstraintsMet: Story = {
  name: 'the week has no constraint violations',
}

export const RequiredAndPreferredViolations: Story = {
  name: 'the week has required and preferred violations',
  args: {
    constraintViolations: sampleViolations.filter(
      ({ type }) =>
        type === 'consecutive-days-exceeded' ||
        type === 'weekly-target-not-met' ||
        type === 'reserve-weekday',
    ),
  },
}

export const PreferredViolationsOnly: Story = {
  name: 'the week has preferred violations only',
  args: {
    constraintViolations: sampleViolations.filter(
      ({ severity }) => severity === 'preferred',
    ),
  },
}

export const Checking: Story = {
  name: 'the week is being checked',
  args: { isLoading: true },
}

export const Incomplete: Story = {
  name: 'the week could not be checked completely',
  args: { isIncomplete: true },
}

export const InvalidDraft: Story = {
  name: 'the edited constraints need to be completed',
  args: { draftInvalid: true },
}
