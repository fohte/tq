import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ProjectListRow } from '#components/project/project-list-row'
import type { Project } from '#hooks/use-projects'

function renderRow(project: Project) {
  const rootRoute = createRootRoute({
    component: () => <ProjectListRow project={project} />,
  })
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => null,
  })
  rootRoute.addChildren([indexRoute])
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  return render(<RouterProvider router={router} />)
}

const baseProject: Project = {
  id: '1',
  title: 'Test Project',
  description: 'A description',
  status: 'active',
  startDate: null,
  targetDate: null,
  color: '#FF8400',
  sortOrder: 0,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  taskCount: { total: 4, completed: 1 },
  completionRate: 0.25,
}

describe('ProjectListRow', () => {
  it('renders project title', async () => {
    renderRow(baseProject)
    await waitFor(() => {
      expect(screen.getAllByText('Test Project').length).toBeGreaterThan(0)
    })
  })

  it('renders project description when present', async () => {
    renderRow(baseProject)
    await waitFor(() => {
      expect(screen.getAllByText('A description').length).toBeGreaterThan(0)
    })
  })

  it('does not render description when null', async () => {
    renderRow({ ...baseProject, description: null })
    await waitFor(() => {
      expect(screen.getAllByText('Test Project').length).toBeGreaterThan(0)
    })
    expect(screen.queryByText('A description')).not.toBeInTheDocument()
  })

  it('renders status badge', async () => {
    renderRow(baseProject)
    await waitFor(() => {
      expect(screen.getAllByText('active').length).toBeGreaterThan(0)
    })
  })

  it('renders paused status badge', async () => {
    renderRow({ ...baseProject, status: 'paused' })
    await waitFor(() => {
      expect(screen.getAllByText('paused').length).toBeGreaterThan(0)
    })
  })

  it('renders completed/total task count', async () => {
    renderRow(baseProject)
    await waitFor(() => {
      expect(screen.getAllByText('1/4').length).toBeGreaterThan(0)
    })
  })
})
