import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { TaskMentionAutocompleteMenuAppearance } from '#components/task/task-mention-autocomplete-menu'
import { makeMentionSuggestion } from '#components/task/task-mention-test-fixtures'

const sampleItems = [
  makeMentionSuggestion(),
  makeMentionSuggestion({ id: '2', number: 120, title: 'Deploy docs site' }),
  makeMentionSuggestion({
    id: '3',
    number: 123,
    title: 'Deprecate old API',
    status: 'completed',
  }),
]

const meta = {
  title: 'Task/TaskMentionAutocompleteMenuAppearance',
  component: TaskMentionAutocompleteMenuAppearance,
  parameters: {
    layout: 'centered',
  },
  args: {
    items: sampleItems,
    highlightedIndex: 0,
    onSelect: fn(),
    onHighlightedIndexChange: fn(),
  },
} satisfies Meta<typeof TaskMentionAutocompleteMenuAppearance>

export default meta
type Story = StoryObj<typeof meta>

export const Results: Story = {}

export const SecondItemHighlighted: Story = {
  args: {
    highlightedIndex: 1,
  },
}

export const NoResults: Story = {
  args: {
    items: [],
  },
}
