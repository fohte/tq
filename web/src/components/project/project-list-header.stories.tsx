import type { Meta, StoryObj } from '@storybook/react-vite'

import { ProjectListHeader } from '#components/project/project-list-header'
import { ProjectListRow } from '#components/project/project-list-row'
import type { Project } from '#hooks/use-projects'
import { StoryRouter } from '#storybook-config/story-router'

const projects: Project[] = [
  {
    id: '1',
    title: 'ISUCON14',
    description: 'Preparation for ISUCON14 competition',
    status: 'active',
    startDate: '2024-11-01',
    targetDate: '2024-12-08',
    color: '#FF5C33',
    sortOrder: 0,
    createdAt: '2024-10-01T00:00:00Z',
    updatedAt: '2024-10-01T00:00:00Z',
    taskCount: { total: 12, completed: 5 },
    completionRate: 5 / 12,
  },
  {
    id: '2',
    title: 'RubyKaigi 2025',
    description: 'Talk preparation and demo setup',
    status: 'paused',
    startDate: null,
    targetDate: null,
    color: '#4A90D9',
    sortOrder: 1,
    createdAt: '2024-10-01T00:00:00Z',
    updatedAt: '2024-10-01T00:00:00Z',
    taskCount: { total: 8, completed: 2 },
    completionRate: 2 / 8,
  },
]

// Renders alongside ProjectListRow so a drift between the two components'
// --project-list-columns usage shows up as a VRT diff.
function ProjectListHeaderStory() {
  return (
    <StoryRouter
      component={() => (
        <div className="dark w-3xl bg-background">
          <ProjectListHeader />
          {projects.map((project) => (
            <ProjectListRow key={project.id} project={project} />
          ))}
        </div>
      )}
    />
  )
}

const meta = {
  title: 'Project/ProjectListHeader',
  component: ProjectListHeaderStory,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof ProjectListHeaderStory>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
