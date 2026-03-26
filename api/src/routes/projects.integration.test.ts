import { app } from '@api/app'
import { assertDefined, jsonBody, setupTestDb } from '@api/testing'
import { describe, expect, it } from 'vitest'

setupTestDb()

const TEST_UUID = '550e8400-e29b-41d4-a716-446655440000'

interface ProjectResponse {
  id: string
  title: string
  description: string | null
  status: string
  startDate: string | null
  targetDate: string | null
  color: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

interface ProjectDetailResponse extends ProjectResponse {
  completionRate: number
  taskCount: { total: number; completed: number }
}

interface TaskResponse {
  id: string
  title: string
  projectId: string | null
}

describe('projects API', () => {
  describe('POST /api/projects', () => {
    it('creates a project with required fields only', async () => {
      const res = await app.request('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'ISUCON 2025' }),
      })

      expect(res.status).toBe(201)
      const body = await jsonBody<ProjectResponse>(res)
      expect(body.title).toBe('ISUCON 2025')
      expect(body.status).toBe('active')
      expect(body.sortOrder).toBe(0)
    })

    it('creates a project with all optional fields', async () => {
      const res = await app.request('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'RubyKaigi',
          description: 'Prepare for RubyKaigi',
          status: 'paused',
          startDate: '2025-04-01',
          targetDate: '2025-05-01',
          color: '#ff0000',
          sortOrder: 5,
        }),
      })

      expect(res.status).toBe(201)
      const body = await jsonBody<ProjectResponse>(res)
      expect(body.title).toBe('RubyKaigi')
      expect(body.description).toBe('Prepare for RubyKaigi')
      expect(body.status).toBe('paused')
      expect(body.startDate).toBe('2025-04-01')
      expect(body.targetDate).toBe('2025-05-01')
      expect(body.color).toBe('#ff0000')
      expect(body.sortOrder).toBe(5)
    })

    it('returns 400 for empty title', async () => {
      const res = await app.request('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '' }),
      })

      expect(res.status).toBe(400)
    })
  })

  describe('GET /api/projects', () => {
    it('returns empty list when no projects exist', async () => {
      const res = await app.request('/api/projects')

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual([])
    })

    it('returns all projects', async () => {
      await createProject('Project A')
      await createProject('Project B')

      const res = await app.request('/api/projects')

      expect(res.status).toBe(200)
      const body = await jsonBody<ProjectResponse[]>(res)
      expect(body).toHaveLength(2)
    })

    it('filters by status', async () => {
      await createProject('Active', { status: 'active' })
      await createProject('Completed', { status: 'completed' })

      const res = await app.request('/api/projects?status=active')

      expect(res.status).toBe(200)
      const body = await jsonBody<ProjectResponse[]>(res)
      expect(body).toHaveLength(1)
      assertDefined(body[0])
      expect(body[0].title).toBe('Active')
    })
  })

  describe('GET /api/projects/:id', () => {
    it('returns project with completion rate when no tasks', async () => {
      const project = await createProject('Empty project')

      const res = await app.request(`/api/projects/${project.id}`)

      expect(res.status).toBe(200)
      const body = await jsonBody<ProjectDetailResponse>(res)
      expect(body.title).toBe('Empty project')
      expect(body.completionRate).toBe(0)
      expect(body.taskCount).toEqual({ total: 0, completed: 0 })
    })

    it('calculates completion rate from associated tasks', async () => {
      const project = await createProject('My project')

      // Create 3 tasks, complete 1
      await createTask('Task 1', { projectId: project.id })
      const task2 = await createTask('Task 2', { projectId: project.id })
      await createTask('Task 3', { projectId: project.id })

      await app.request(`/api/tasks/${task2.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      })

      const res = await app.request(`/api/projects/${project.id}`)

      expect(res.status).toBe(200)
      const body = await jsonBody<ProjectDetailResponse>(res)
      expect(body.completionRate).toBeCloseTo(1 / 3)
      expect(body.taskCount).toEqual({ total: 3, completed: 1 })
    })

    it('returns 404 for non-existent project', async () => {
      const res = await app.request(`/api/projects/${TEST_UUID}`)

      expect(res.status).toBe(404)
    })
  })

  describe('GET /api/projects/:id/tasks', () => {
    it('returns tasks belonging to the project', async () => {
      const project = await createProject('My project')
      await createTask('Task in project', { projectId: project.id })
      await createTask('Task without project')

      const res = await app.request(`/api/projects/${project.id}/tasks`)

      expect(res.status).toBe(200)
      const body = await jsonBody<TaskResponse[]>(res)
      expect(body).toHaveLength(1)
      assertDefined(body[0])
      expect(body[0].title).toBe('Task in project')
    })

    it('returns 404 for non-existent project', async () => {
      const res = await app.request(`/api/projects/${TEST_UUID}/tasks`)

      expect(res.status).toBe(404)
    })
  })

  describe('PATCH /api/projects/:id', () => {
    it('updates project fields', async () => {
      const project = await createProject('Original')

      const res = await app.request(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Updated', status: 'completed' }),
      })

      expect(res.status).toBe(200)
      const body = await jsonBody<ProjectResponse>(res)
      expect(body.title).toBe('Updated')
      expect(body.status).toBe('completed')
    })

    it('sets nullable fields to null', async () => {
      const project = await createProject('With desc', {
        description: 'Some desc',
      })

      const res = await app.request(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: null }),
      })

      expect(res.status).toBe(200)
      const body = await jsonBody<ProjectResponse>(res)
      expect(body.description).toBeNull()
    })

    it('returns 404 for non-existent project', async () => {
      const res = await app.request(`/api/projects/${TEST_UUID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Updated' }),
      })

      expect(res.status).toBe(404)
    })
  })

  describe('DELETE /api/projects/:id', () => {
    it('deletes a project', async () => {
      const project = await createProject('To delete')

      const res = await app.request(`/api/projects/${project.id}`, {
        method: 'DELETE',
      })

      expect(res.status).toBe(204)

      const getRes = await app.request(`/api/projects/${project.id}`)
      expect(getRes.status).toBe(404)
    })

    it('sets task project_id to null on project deletion', async () => {
      const project = await createProject('To delete')
      const task = await createTask('Task in project', {
        projectId: project.id,
      })

      await app.request(`/api/projects/${project.id}`, { method: 'DELETE' })

      const taskRes = await app.request(`/api/tasks/${task.id}`)
      expect(taskRes.status).toBe(200)
      const taskBody = await jsonBody<TaskResponse>(taskRes)
      expect(taskBody.projectId).toBeNull()
    })

    it('returns 404 for non-existent project', async () => {
      const res = await app.request(`/api/projects/${TEST_UUID}`, {
        method: 'DELETE',
      })

      expect(res.status).toBe(404)
    })
  })

  describe('task project_id via PATCH /api/tasks/:id', () => {
    it('sets project_id on a task', async () => {
      const project = await createProject('My project')
      const task = await createTask('My task')

      const res = await app.request(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id }),
      })

      expect(res.status).toBe(200)
      const body = await jsonBody<TaskResponse>(res)
      expect(body.projectId).toBe(project.id)
    })

    it('clears project_id from a task', async () => {
      const project = await createProject('My project')
      const task = await createTask('My task', { projectId: project.id })

      const res = await app.request(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: null }),
      })

      expect(res.status).toBe(200)
      const body = await jsonBody<TaskResponse>(res)
      expect(body.projectId).toBeNull()
    })
  })
})

async function createProject(
  title: string,
  opts: {
    description?: string
    status?: string
    startDate?: string
    targetDate?: string
    color?: string
  } = {},
) {
  const res = await app.request('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, ...opts }),
  })
  if (res.status !== 201) {
    throw new Error(
      `Failed to create project: ${String(res.status)} ${await res.text()}`,
    )
  }
  return jsonBody<ProjectResponse>(res)
}

async function createTask(title: string, opts: { projectId?: string } = {}) {
  const res = await app.request('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, ...opts }),
  })
  if (res.status !== 201) {
    throw new Error(
      `Failed to create task: ${String(res.status)} ${await res.text()}`,
    )
  }
  return jsonBody<TaskResponse>(res)
}
