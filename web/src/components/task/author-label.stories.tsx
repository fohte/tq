import type { Meta, StoryObj } from '@storybook/react-vite'

import { AuthorLabel } from '#components/task/author-label'
import { makeAuthorInfo } from '#components/task/task-author-test-fixtures'

const meta = {
  title: 'Task/AuthorLabel',
  component: AuthorLabel,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof AuthorLabel>

export default meta
type Story = StoryObj<typeof meta>

export const LlmAuthor: Story = {
  name: 'the label shows the agent name for an LLM-authored task',
  args: {
    author: makeAuthorInfo({ kind: 'llm', agent: 'sample-agent' }),
  },
}

export const ServiceAuthor: Story = {
  name: 'the label shows the name of the service that authored the task',
  args: {
    author: makeAuthorInfo({ kind: 'service', agent: 'sample-service' }),
  },
}

export const CompactServiceAuthor: Story = {
  name: 'the compact service label truncates a long name on narrow screens',
  args: {
    author: makeAuthorInfo({
      kind: 'service',
      agent: 'sample-service-with-a-long-name',
    }),
    compact: true,
  },
  tags: ['mobile-only'],
}
