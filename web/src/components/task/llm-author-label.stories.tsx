import type { Meta, StoryObj } from '@storybook/react-vite'

import { LlmAuthorLabel } from '#components/task/llm-author-label'
import { makeAuthorInfo } from '#components/task/task-author-test-fixtures'

const meta = {
  title: 'Task/LlmAuthorLabel',
  component: LlmAuthorLabel,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof LlmAuthorLabel>

export default meta
type Story = StoryObj<typeof meta>

export const LlmAuthor: Story = {
  name: 'labels an LLM-authored task with its agent name',
  args: {
    author: makeAuthorInfo({ kind: 'llm', agent: 'sample-agent' }),
  },
}
