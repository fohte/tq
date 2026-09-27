import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { EditableMarkdownDescription } from '#components/ui/editable-markdown-description'

type DescriptionSurface = 'task' | 'project'

type DescriptionStoryProps = {
  surface: DescriptionSurface
  defaultValue: string | null
  initiallyEditing?: boolean
}

function DescriptionStory({
  surface,
  defaultValue,
  initiallyEditing,
}: DescriptionStoryProps) {
  const isProject = surface === 'project'

  return (
    <div className="max-w-2xl">
      {isProject && (
        <div className="mb-1 text-xs text-muted-foreground">Description</div>
      )}
      <EditableMarkdownDescription
        defaultValue={defaultValue}
        surface={surface}
        placeholder="Add description..."
        editButtonLabel={`Edit ${surface} description`}
        onChange={fn()}
        onExitEditMode={fn()}
        {...(initiallyEditing != null ? { initiallyEditing } : {})}
      />
    </div>
  )
}

const meta = {
  title: 'Task and Project/EditableMarkdownDescription',
  component: DescriptionStory,
  parameters: {
    layout: 'padded',
  },
  args: {
    surface: 'task',
    defaultValue:
      '## Notes\n\nKeep the initial checklist short.\n\n- Review the draft\n- Share the result',
  },
} satisfies Meta<typeof DescriptionStory>

export default meta
type Story = StoryObj<typeof meta>

const taskDescription =
  '## Notes\n\nKeep the initial checklist short.\n\n- Review the draft\n- Share the result'
const projectDescription =
  '## Goal\n\nTrack a small project from planning to delivery.'

export const TaskWithContent: Story = {
  name: 'the task description stays in view mode with its pencil button',
  args: {
    surface: 'task',
    defaultValue: taskDescription,
  },
}

export const EmptyTask: Story = {
  name: 'an empty task description shows its placeholder and pencil button',
  args: {
    surface: 'task',
    defaultValue: null,
  },
}

export const EditingTask: Story = {
  name: 'the task description is open in edit mode',
  args: {
    surface: 'task',
    defaultValue: taskDescription,
    initiallyEditing: true,
  },
}

export const ProjectWithContent: Story = {
  name: 'the project description stays in view mode with its pencil button',
  args: {
    surface: 'project',
    defaultValue: projectDescription,
  },
}

export const EmptyProject: Story = {
  name: 'an empty project description shows its placeholder and pencil button',
  args: {
    surface: 'project',
    defaultValue: null,
  },
}

export const EditingProject: Story = {
  name: 'the project description is open in edit mode',
  args: {
    surface: 'project',
    defaultValue: projectDescription,
    initiallyEditing: true,
  },
}
