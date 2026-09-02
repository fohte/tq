import type { Meta, StoryObj } from '@storybook/react-vite'

import { ProjectListRow } from '#components/project/project-list-row'
import { makeProject } from '#components/project/project-test-fixtures'
import type { Project } from '#hooks/use-projects'
import { StoryRouter } from '#storybook-config/story-router'

const baseProject: Project = makeProject({
  id: '1',
  title: 'ISUCON14',
  description: 'Preparation for ISUCON14 competition',
  startDate: '2024-11-01',
  targetDate: '2024-12-08',
  color: '#FF5C33',
  createdAt: '2024-10-01T00:00:00Z',
  updatedAt: '2024-10-01T00:00:00Z',
  taskCount: { total: 12, completed: 5 },
  completionRate: 5 / 12,
})

function ProjectListRowStory(
  props: React.ComponentProps<typeof ProjectListRow>,
) {
  return (
    <StoryRouter
      component={() => (
        <div className="dark w-full max-w-3xl bg-background">
          <ProjectListRow {...props} />
        </div>
      )}
    />
  )
}

const meta = {
  title: 'Project/ProjectListRow',
  component: ProjectListRowStory,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof ProjectListRowStory>

export default meta
type Story = StoryObj<typeof meta>

export const Active: Story = {
  args: {
    project: baseProject,
  },
}

export const Paused: Story = {
  args: {
    project: makeProject({
      id: '2',
      title: 'RubyKaigi 2025',
      description: 'Talk preparation and demo setup',
      status: 'paused',
      color: '#4A90D9',
      createdAt: '2024-10-01T00:00:00Z',
      updatedAt: '2024-10-01T00:00:00Z',
      taskCount: { total: 8, completed: 2 },
      completionRate: 2 / 8,
    }),
  },
}

export const Completed: Story = {
  args: {
    project: makeProject({
      id: '3',
      title: 'Completed Project',
      status: 'completed',
      startDate: '2024-06-01',
      targetDate: '2024-09-30',
      color: '#4CAF50',
      createdAt: '2024-10-01T00:00:00Z',
      updatedAt: '2024-10-01T00:00:00Z',
      taskCount: { total: 10, completed: 10 },
      completionRate: 1,
    }),
  },
}

export const Archived: Story = {
  args: {
    project: makeProject({
      id: '4',
      title: 'Archived Project',
      description: 'No longer active',
      status: 'archived',
      startDate: '2023-01-01',
      targetDate: '2023-06-30',
      color: '#71717A',
      createdAt: '2024-10-01T00:00:00Z',
      updatedAt: '2024-10-01T00:00:00Z',
      taskCount: { total: 6, completed: 4 },
      completionRate: 4 / 6,
    }),
  },
}

export const NoDescription: Story = {
  args: {
    project: makeProject({
      id: '5',
      title: 'Minimal Project',
      color: '#9B59B6',
      createdAt: '2024-10-01T00:00:00Z',
      updatedAt: '2024-10-01T00:00:00Z',
      taskCount: { total: 3, completed: 0 },
    }),
  },
}

export const NoTargetDate: Story = {
  args: {
    project: makeProject({
      id: '6',
      title: 'No Target Date',
      description: 'Ongoing work without a deadline',
      startDate: '2024-11-01',
      color: '#FF5C33',
      createdAt: '2024-10-01T00:00:00Z',
      updatedAt: '2024-10-01T00:00:00Z',
      taskCount: { total: 4, completed: 1 },
      completionRate: 1 / 4,
    }),
  },
}

export const AllVariants: Story = {
  args: { project: baseProject },
  render: () => {
    const projects: Project[] = [
      baseProject,
      makeProject({
        id: '2',
        title: 'RubyKaigi 2025',
        description: 'Talk preparation and demo setup',
        status: 'paused',
        startDate: '2024-11-01',
        color: '#FF5C33',
        createdAt: '2024-10-01T00:00:00Z',
        updatedAt: '2024-10-01T00:00:00Z',
        taskCount: { total: 8, completed: 2 },
        completionRate: 2 / 8,
      }),
      makeProject({
        id: '3',
        title: 'Completed Project',
        status: 'completed',
        startDate: '2024-11-01',
        targetDate: '2024-12-08',
        color: '#FF5C33',
        createdAt: '2024-10-01T00:00:00Z',
        updatedAt: '2024-10-01T00:00:00Z',
        taskCount: { total: 10, completed: 10 },
        completionRate: 1,
      }),
      makeProject({
        id: '4',
        title: 'Archived Project',
        description: 'No longer active',
        status: 'archived',
        startDate: '2024-11-01',
        targetDate: '2024-12-08',
        color: '#FF5C33',
        createdAt: '2024-10-01T00:00:00Z',
        updatedAt: '2024-10-01T00:00:00Z',
        taskCount: { total: 6, completed: 4 },
        completionRate: 4 / 6,
      }),
    ]

    return (
      <StoryRouter
        component={() => (
          <div className="dark w-full max-w-3xl divide-y divide-border bg-background">
            {projects.map((project) => (
              <ProjectListRow key={project.id} project={project} />
            ))}
          </div>
        )}
      />
    )
  },
}
