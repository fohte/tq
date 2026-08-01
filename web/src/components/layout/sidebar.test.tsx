import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Sidebar } from '#components/layout/sidebar'
import { ContextFilterProvider } from '#hooks/use-context-filter'
import type { Project } from '#hooks/use-projects'
import { projectKeys } from '#hooks/use-projects'
import { TagFilterProvider } from '#hooks/use-tag-filter'
import type { Task } from '#hooks/use-tasks'
import { taskKeys } from '#hooks/use-tasks'

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    ...props
  }: { children: React.ReactNode } & Record<string, unknown>) => (
    <a href={typeof props['to'] === 'string' ? props['to'] : '#'}>{children}</a>
  ),
  useMatchRoute: () => () => false,
}))

const baseTask: Task = {
  id: '00000000-0000-0000-0000-000000000001',
  number: 1,
  title: 'Implement task list UI',
  description: null,
  status: 'todo',
  context: 'personal',
  labels: [],
  startDate: null,
  dueDate: null,
  estimatedMinutes: null,
  parentId: null,
  parentNumber: null,
  projectId: null,
  sortOrder: 0,
  recurrenceRuleId: null,
  recurrenceRule: null,
  githubLink: null,
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
}

const tasksWithTags: Task[] = [
  { ...baseTask, id: '1', title: 'Task A', labels: ['dev:tq', 'urgent'] },
  { ...baseTask, id: '2', title: 'Task B', labels: ['dev:tq'] },
]

const baseProject: Project = {
  id: '00000000-0000-0000-0000-000000000101',
  title: 'tq',
  description: null,
  status: 'active',
  startDate: null,
  targetDate: null,
  color: null,
  sortOrder: 0,
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
  completionRate: 0,
  taskCount: { total: 0, completed: 0 },
}

function renderSidebar(tasks: Task[] = [], projects: Project[] = []) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  queryClient.setQueryData(taskKeys.list(undefined), tasks)
  queryClient.setQueryData(projectKeys.list(undefined), projects)

  return render(
    <QueryClientProvider client={queryClient}>
      <ContextFilterProvider>
        <TagFilterProvider>
          <Sidebar />
        </TagFilterProvider>
      </ContextFilterProvider>
    </QueryClientProvider>,
  )
}

describe('Sidebar', () => {
  it('is hidden below the md breakpoint', () => {
    renderSidebar()
    expect(screen.getByRole('complementary').className).toBe(
      'hidden h-screen w-[200px] shrink-0 flex-col border-r border-border bg-sidebar md:flex',
    )
  })

  describe('TagsSection', () => {
    it('shows each tag with its name and count', () => {
      renderSidebar(tasksWithTags)

      const devTqButton = screen.getByRole('button', { name: /dev:tq/ })
      const urgentButton = screen.getByRole('button', { name: /urgent/ })
      expect(devTqButton).toHaveTextContent('#dev:tq2')
      expect(urgentButton).toHaveTextContent('#urgent1')
    })

    it('does not show the clear button when no tag is selected', () => {
      renderSidebar(tasksWithTags)
      expect(
        screen.queryByRole('button', { name: 'clear ×' }),
      ).not.toBeInTheDocument()
    })

    it('selects a tag and shows the clear button when it is clicked', async () => {
      const user = userEvent.setup()
      renderSidebar(tasksWithTags)

      const tagButton = screen.getByRole('button', { name: /dev:tq/ })
      expect(tagButton).toHaveAttribute('aria-pressed', 'false')

      await user.click(tagButton)

      expect(tagButton).toHaveAttribute('aria-pressed', 'true')
      expect(
        screen.getByRole('button', { name: 'clear ×' }),
      ).toBeInTheDocument()
    })

    it('deselects the tag when clicking it again', async () => {
      const user = userEvent.setup()
      renderSidebar(tasksWithTags)

      const tagButton = screen.getByRole('button', { name: /dev:tq/ })
      await user.click(tagButton)
      await user.click(tagButton)

      expect(tagButton).toHaveAttribute('aria-pressed', 'false')
      expect(
        screen.queryByRole('button', { name: 'clear ×' }),
      ).not.toBeInTheDocument()
    })
  })

  describe('ProjectsSection', () => {
    it("shows a project's completed/total ratio", () => {
      renderSidebar(
        [],
        [
          {
            ...baseProject,
            id: '1',
            title: 'Project Alpha',
            status: 'active',
            taskCount: { completed: 3, total: 10 },
          },
        ],
      )

      expect(
        screen.getByRole('link', { name: /Project Alpha/ }),
      ).toHaveTextContent('Project Alpha3/10')
    })

    it('shows both active and paused projects together', () => {
      renderSidebar(
        [],
        [
          {
            ...baseProject,
            id: '1',
            title: 'Project Alpha',
            status: 'active',
            taskCount: { completed: 1, total: 2 },
          },
          {
            ...baseProject,
            id: '2',
            title: 'Project Beta',
            status: 'paused',
            taskCount: { completed: 5, total: 5 },
          },
        ],
      )

      const projectLinks = screen.getAllByRole('link', {
        name: /^Project (Alpha|Beta)/,
      })
      expect(projectLinks.map((link) => link.textContent)).toEqual([
        'Project Alpha1/2',
        'Project Beta5/5',
      ])
    })
  })
})
