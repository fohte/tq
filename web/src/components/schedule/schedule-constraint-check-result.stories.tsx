import type { Meta, StoryObj } from '@storybook/react-vite'

import { ScheduleConstraintCheckResult } from '#components/schedule/schedule-constraint-check-result'
import {
  makeMixedSeverityScheduleConstraintViolations,
  makeScheduleConstraintViolations,
} from '#components/schedule/schedule-test-fixtures'

const sampleViolations = makeScheduleConstraintViolations()

const meta = {
  title: 'Schedule/ScheduleConstraintCheckResult',
  component: ScheduleConstraintCheckResult,
  args: {
    startDate: '2041-05-13',
    endDate: '2041-05-19',
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
    constraintViolations: makeMixedSeverityScheduleConstraintViolations(),
  },
}

export const RequiredViolationsOnly: Story = {
  name: 'the week has only required violations',
  args: {
    constraintViolations: sampleViolations.filter(
      ({ severity }) => severity === 'required',
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

export const IncompleteWithViolations: Story = {
  name: 'the week has violations and an incomplete check',
  args: {
    constraintViolations: sampleViolations.slice(0, 1),
    isIncomplete: true,
  },
}

export const InvalidDraft: Story = {
  name: 'the edited constraints need to be completed',
  args: { constraintViolations: sampleViolations, draftInvalid: true },
}

export const Error: Story = {
  name: 'the check could not be completed',
  args: { isError: true },
}
