import type { Meta, StoryObj } from '@storybook/react-vite'

import { TagTokens } from '#components/task/task-row-shared'

// Clicking a tag navigates to /tasks via useNavigate, and the Storybook
// preview already wraps every story in a router (see .storybook/preview.tsx),
// so no extra provider setup is needed here.
function TagTokensDemo({
  labels,
  isCompleted,
}: {
  labels: string[]
  isCompleted: boolean
}) {
  return (
    <div className="w-80 border border-border p-3">
      <TagTokens labels={labels} isCompleted={isCompleted} />
    </div>
  )
}

const meta = {
  title: 'Task/TagTokens',
  component: TagTokensDemo,
} satisfies Meta<typeof TagTokensDemo>

export default meta
type Story = StoryObj<typeof meta>

export const SingleLabel: Story = {
  args: {
    labels: ['dev:tq'],
    isCompleted: false,
  },
}

export const MultipleLabels: Story = {
  args: {
    labels: ['dev:tq', 'chore', 'urgent'],
    isCompleted: false,
  },
}

export const CompletedTask: Story = {
  args: {
    labels: ['dev:tq'],
    isCompleted: true,
  },
}

export const TagClick: Story = {
  args: {
    labels: ['dev:tq'],
    isCompleted: false,
  },
  play: async ({ canvas, userEvent }) => {
    // Clicking navigates to /tasks scoped to the tag (see task-row.test.tsx
    // and tree-task-grid-row.test.tsx for the assertion on the resulting
    // query); this story only exercises that the click doesn't throw.
    await userEvent.click(canvas.getByText('#dev:tq'))
  },
}
