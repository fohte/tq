import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ComponentProps } from 'react'
import { useRef } from 'react'
import { fn } from 'storybook/test'

import { CreateTaskInlineSuggestionMenu } from '#components/task/create-task-inline-suggestion-menu'
import type { SuggestionItem } from '#lib/task-input-parser'

const suggestions: SuggestionItem[] = [
  { value: 'today', display: 'today' },
  { value: 'tomorrow', display: 'tomorrow' },
  { value: '30m', display: '30m' },
]

function CreateTaskInlineSuggestionMenuDemo(
  props: Omit<ComponentProps<typeof CreateTaskInlineSuggestionMenu>, 'anchor'>,
) {
  const anchorRef = useRef<HTMLInputElement>(null)

  return (
    <div className="w-48">
      <input
        ref={anchorRef}
        type="text"
        defaultValue="@"
        className="w-full rounded-md border border-input px-2 py-1 text-sm"
      />
      <CreateTaskInlineSuggestionMenu {...props} anchor={anchorRef} />
    </div>
  )
}

const meta = {
  title: 'Task/CreateTaskInlineSuggestionMenu',
  component: CreateTaskInlineSuggestionMenuDemo,
  parameters: {
    layout: 'centered',
  },
  args: {
    open: true,
    onOpenChange: fn(),
    trigger: '@',
    suggestions,
    onSelectSuggestion: fn(),
  },
} satisfies Meta<typeof CreateTaskInlineSuggestionMenuDemo>

export default meta
type Story = StoryObj<typeof meta>

export const FirstHighlighted: Story = {
  args: {
    selectedIndex: 0,
  },
}

export const SecondHighlighted: Story = {
  args: {
    selectedIndex: 1,
  },
}
