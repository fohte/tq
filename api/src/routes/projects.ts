import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'

const projectStatus = z.enum(['active', 'paused', 'completed', 'archived'])

const createProjectSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  status: projectStatus.optional(),
  startDate: z.string().optional(),
  targetDate: z.string().optional(),
  color: z.string().optional(),
  sortOrder: z.number().int().optional(),
})

const updateProjectSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  status: projectStatus.optional(),
  startDate: z.string().nullable().optional(),
  targetDate: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
})

export const projectsApp = new Hono()
  .post('/', zValidator('json', createProjectSchema), (c) => {
    // TODO: implement project creation
    return c.json({ message: 'not implemented' }, 501)
  })
  .get('/', (c) => {
    // TODO: implement project listing
    return c.json([], 200)
  })
  .get('/:id', (c) => {
    // TODO: implement project retrieval by ID
    void c.req.param('id')
    return c.json({ message: 'not implemented' }, 501)
  })
  .get('/:id/tasks', (c) => {
    // TODO: implement project tasks listing
    void c.req.param('id')
    return c.json([], 200)
  })
  .patch('/:id', zValidator('json', updateProjectSchema), (c) => {
    // TODO: implement project update
    void c.req.param('id')
    return c.json({ message: 'not implemented' }, 501)
  })
  .delete('/:id', (c) => {
    // TODO: implement project deletion
    void c.req.param('id')
    return c.json(null, 501)
  })
