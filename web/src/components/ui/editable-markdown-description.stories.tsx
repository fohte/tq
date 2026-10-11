import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { LlmAuthorLabel } from '#components/task/llm-author-label'
import { makeAuthorInfo } from '#components/task/task-author-test-fixtures'
import { EditableMarkdownDescription } from '#components/ui/editable-markdown-description'

const meta = {
  title: 'Task and Project/EditableMarkdownDescription',
  component: EditableMarkdownDescription,
  parameters: {
    layout: 'padded',
  },
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
  args: {
    defaultValue:
      '## Notes\n\nKeep the initial checklist short.\n\n- Review the draft\n- Share the result',
    placeholder: 'Add description...',
    editButtonLabel: 'Edit description',
    onChange: fn(),
    onExitEditMode: fn(),
  },
} satisfies Meta<typeof EditableMarkdownDescription>

export default meta
type Story = StoryObj<typeof meta>

const llmHeader = (
  <LlmAuthorLabel
    author={makeAuthorInfo({ kind: 'llm', agent: 'sample-agent' })}
  />
)
const projectHeader = (
  <span className="text-xs text-muted-foreground">Description</span>
)
const projectDescription =
  '## Goal\n\nTrack a small project from planning to delivery.'

export const TaskWithContent: Story = {
  name: 'the task description shows the LLM author chip and a pencil button above the box',
  args: { variant: 'task', header: llmHeader },
}

export const EmptyTask: Story = {
  name: 'an empty task description shows its placeholder and a pencil button',
  args: { variant: 'task', defaultValue: null },
}

export const EditingTask: Story = {
  name: 'the task description is open in edit mode without the pencil button',
  args: {
    variant: 'task',
    header: llmHeader,
    initiallyEditing: true,
  },
}

export const ProjectWithContent: Story = {
  name: 'the project description shows its label and a pencil button above the box',
  args: {
    variant: 'project',
    header: projectHeader,
    defaultValue: projectDescription,
  },
}

export const EmptyProject: Story = {
  name: 'an empty project description shows its placeholder and a pencil button',
  args: {
    variant: 'project',
    header: projectHeader,
    defaultValue: null,
  },
}

export const EditingProject: Story = {
  name: 'the project description is open in edit mode without the pencil button',
  args: {
    variant: 'project',
    header: projectHeader,
    defaultValue: projectDescription,
    initiallyEditing: true,
  },
}

export const InlineWait: Story = {
  name: 'the inline wait description has no surrounding editor chrome',
  args: {
    variant: 'inline',
    defaultValue: 'Waiting for the team to confirm the schedule.',
  },
}

export const InlineWaitEditing: Story = {
  name: 'the inline wait description is open in Markdown edit mode',
  args: {
    variant: 'inline',
    defaultValue: 'Waiting for the team to confirm the schedule.',
    initiallyEditing: true,
  },
}
