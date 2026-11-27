import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import {
  makeProjectField,
  makeProjectFieldOption,
} from '#components/project/project-test-fixtures'
import { TaskFieldFilterChips } from '#components/task/task-field-filter-chips'
import { makeParsedQuery } from '#components/task/task-filter-test-fixtures'

const fields = [
  makeProjectField({
    id: 'field-category',
    name: 'SampleCategory',
    options: [
      makeProjectFieldOption({ id: 'option-alpha', name: 'Alpha' }),
      makeProjectFieldOption({ id: 'option-beta', name: 'Beta' }),
    ],
  }),
]

const meta = {
  title: 'Task/TaskFieldFilterChips',
  component: TaskFieldFilterChips,
  args: {
    projectFields: fields,
    parsed: makeParsedQuery(),
    onChange: fn(),
  },
} satisfies Meta<typeof TaskFieldFilterChips>

export default meta
type Story = StoryObj<typeof meta>

export const Unfiltered: Story = {
  name: 'the project field chip has no active filter',
}

export const OptionSelected: Story = {
  name: 'the project field chip filters for one option',
  args: {
    parsed: makeParsedQuery({ fields: { SampleCategory: 'Alpha' } }),
  },
}

export const UnsetSelected: Story = {
  name: 'the project field chip filters for tasks without a value',
  args: {
    parsed: makeParsedQuery({ fields: { SampleCategory: null } }),
  },
}

export const ReservedOptionNames: Story = {
  name: 'the menu distinguishes options from Any and Unset states',
  args: {
    defaultOpen: true,
    projectFields: [
      makeProjectField({
        id: 'field-reserved',
        name: 'SampleCategory',
        options: [
          makeProjectFieldOption({ id: 'option-any', name: 'Any' }),
          makeProjectFieldOption({ id: 'option-unset', name: 'Unset' }),
        ],
      }),
    ],
  },
}
