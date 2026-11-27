import type { Meta, StoryObj } from '@storybook/react-vite'

import {
  makeProjectDetail,
  makeProjectField,
  makeProjectFieldOption,
} from '#components/project/project-test-fixtures'
import { TaskSidebarMobile } from '#components/task/task-detail-sidebar'
import {
  makeTaskDetail,
  makeTaskFieldValue,
} from '#components/task/task-row-test-fixtures'
import { TaskSidebarStoryProviders } from '#components/task/task-sidebar-story-test-fixtures'
import type { ProjectField } from '#hooks/use-project-fields'
import type { ProjectDetail } from '#hooks/use-projects'
import type { TaskDetail } from '#hooks/use-tasks'

function MobileSidebarStory({
  task,
  project,
  projectFields,
}: {
  task: TaskDetail
  project?: ProjectDetail | undefined
  projectFields?: ProjectField[] | undefined
}) {
  return (
    <TaskSidebarStoryProviders project={project} projectFields={projectFields}>
      <div className="max-w-sm border-t border-border p-4">
        <TaskSidebarMobile task={task} />
      </div>
    </TaskSidebarStoryProviders>
  )
}

const meta = {
  title: 'Task/TaskDetail/Sidebar',
  component: MobileSidebarStory,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof MobileSidebarStory>

export default meta
type Story = StoryObj<typeof meta>

export const MobileSidebar: Story = {
  name: 'task details appear in the compact mobile sidebar',
  args: {
    task: makeTaskDetail(),
  },
}

export const MobileSidebarWithChecklistProgress: Story = {
  name: 'the mobile sidebar shows checklist progress',
  args: {
    task: makeTaskDetail({
      checklistCompletionCount: { completed: 1, total: 4 },
    }),
  },
}

const mobileProject = makeProjectDetail({
  id: 'bbbb0000-0000-0000-0000-000000000000',
})

export const MobileSidebarWithProjectNoFields: Story = {
  name: 'the mobile sidebar shows a project with no custom fields',
  args: {
    task: makeTaskDetail({ projectId: mobileProject.id }),
    project: mobileProject,
    projectFields: [],
  },
}

const mobileFieldOption = makeProjectFieldOption({
  id: 'option-triage',
  name: 'Triage',
})
const mobileField = makeProjectField({
  id: 'field-phase',
  projectId: mobileProject.id,
  name: 'WorkPhase',
  options: [mobileFieldOption],
})

export const MobileSidebarWithCustomField: Story = {
  name: 'the mobile sidebar shows and selects a project custom field',
  args: {
    task: makeTaskDetail({
      projectId: mobileProject.id,
      fieldValues: [
        makeTaskFieldValue({
          fieldId: mobileField.id,
          fieldName: mobileField.name,
          optionId: mobileFieldOption.id,
          optionName: mobileFieldOption.name,
        }),
      ],
    }),
    project: mobileProject,
    projectFields: [mobileField],
  },
}
