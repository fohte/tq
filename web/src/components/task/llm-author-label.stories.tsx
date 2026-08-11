import type { Meta, StoryObj } from '@storybook/react-vite'

import { LlmAuthorLabel } from '#components/task/llm-author-label'

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
  args: {
    author: { kind: 'llm', agent: 'claude-opus-5' },
  },
}
