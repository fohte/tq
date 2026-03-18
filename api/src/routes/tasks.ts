import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'

const taskStatus = z.enum(['todo', 'in_progress', 'completed'])
const context = z.enum(['work', 'personal', 'dev'])

const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  estimatedMinutes: z.number().int().positive().optional(),
  parentId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  context: context.optional(),
})

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  estimatedMinutes: z.number().int().positive().nullable().optional(),
  parentId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  context: context.optional(),
})

const updateStatusSchema = z.object({
  status: taskStatus,
})

const updateParentSchema = z.object({
  parentId: z.string().uuid().nullable(),
})

const listQuerySchema = z.object({
  status: taskStatus.optional(),
  projectId: z.string().uuid().optional(),
  parentId: z.string().uuid().optional(),
})

const treeQuerySchema = z.object({
  rootId: z.string().uuid().optional(),
})

const searchQuerySchema = z.object({
  q: z.string().optional(),
  status: taskStatus.optional(),
  label: z.string().optional(),
  context: context.optional(),
  hasEstimate: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
  hasDue: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
  sortBy: z.enum(['due', 'created', 'estimate']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
})

const suggestQuerySchema = z.object({
  prefix: z.string(),
  category: z.string().optional(),
})

export const tasksApp = new Hono()
  // Task CRUD
  .post('/', zValidator('json', createTaskSchema), (c) => {
    // TODO: implement task creation
    return c.json({ message: 'not implemented' }, 501)
  })
  .get('/', zValidator('query', listQuerySchema), (c) => {
    // TODO: implement task listing
    return c.json([], 200)
  })
  .get('/tree', zValidator('query', treeQuerySchema), (c) => {
    // TODO: implement tree retrieval
    return c.json([], 200)
  })
  .get('/search', zValidator('query', searchQuerySchema), (c) => {
    // TODO: implement search
    return c.json([], 200)
  })
  .get('/search/suggest', zValidator('query', suggestQuerySchema), (c) => {
    // TODO: implement search suggestions
    return c.json([], 200)
  })
  .get('/:id', (c) => {
    // TODO: implement task retrieval by ID
    void c.req.param('id')
    return c.json({ message: 'not implemented' }, 501)
  })
  .patch('/:id', zValidator('json', updateTaskSchema), (c) => {
    // TODO: implement task update
    void c.req.param('id')
    return c.json({ message: 'not implemented' }, 501)
  })
  .patch('/:id/status', zValidator('json', updateStatusSchema), (c) => {
    // TODO: implement status update
    void c.req.param('id')
    return c.json({ message: 'not implemented' }, 501)
  })
  .patch('/:id/parent', zValidator('json', updateParentSchema), (c) => {
    // TODO: implement parent update
    void c.req.param('id')
    return c.json({ message: 'not implemented' }, 501)
  })
  .delete('/:id', (c) => {
    // TODO: implement task deletion
    void c.req.param('id')
    return c.json(null, 501)
  })
