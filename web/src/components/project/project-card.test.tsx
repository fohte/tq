import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen, waitFor } from '@testing-library/react'
import { ProjectCard } from '@web/components/project/project-card'
import type { Project } from '@web/hooks/use-projects'
import { describe, expect, it } from 'vitest'

function renderCard(project: Project) {
  const rootRoute = createRootRoute({
    component: () => <ProjectCard project={project} />,
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
}

describe('ProjectCard', () => {
  it('renders project title', async () => {
    renderCard(baseProject)
    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument()
    })
  })

  it('renders project description when present', async () => {
    renderCard(baseProject)
    await waitFor(() => {
      expect(screen.getByText('A description')).toBeInTheDocument()
    })
  })

  it('does not render description when null', async () => {
    renderCard({ ...baseProject, description: null })
    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument()
    })
    expect(screen.queryByText('A description')).not.toBeInTheDocument()
  })

  it('renders status badge', async () => {
    renderCard(baseProject)
    await waitFor(() => {
      expect(screen.getByText('Active')).toBeInTheDocument()
    })
  })

  it('renders paused status badge', async () => {
    renderCard({ ...baseProject, status: 'paused' })
    await waitFor(() => {
      expect(screen.getByText('Paused')).toBeInTheDocument()
    })
  })
})
