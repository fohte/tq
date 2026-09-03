import type { Meta, StoryObj } from '@storybook/react-vite'

import { TaskKanbanSeeAllLink } from '#components/kanban/task-kanban-see-all-link'
import { StoryRouter } from '#storybook-config/story-router'

function TaskKanbanSeeAllLinkWithRouter(
  props: React.ComponentProps<typeof TaskKanbanSeeAllLink>,
) {
  return (
    <StoryRouter
      component={() => <TaskKanbanSeeAllLink {...props} />}
      paths={['/tasks']}
    />
  )
}

const meta = {
  title: 'Kanban/TaskKanbanSeeAllLink',
  component: TaskKanbanSeeAllLinkWithRouter,
} satisfies Meta<typeof TaskKanbanSeeAllLinkWithRouter>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    commitment: 'active',
  },
}
