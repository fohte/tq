import { z } from 'zod'

import { recurrenceRuleSchema } from '#schemas/recurrence-rule'

export const taskStatus = z.enum(['todo', 'in_progress', 'completed'])
export const contextEnum = z.enum(['work', 'personal'])

export const taskListSortBy = z.enum(['created', 'updated'])
export type TaskListSortBy = z.infer<typeof taskListSortBy>

export const taskSortBy = z.enum(['created', 'updated', 'due', 'estimate'])
export type TaskSortBy = z.infer<typeof taskSortBy>

const hasFlagSchema = z
  .string()
  .transform((v) => v === 'true')
  .optional()

export const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  estimatedMinutes: z.number().int().positive().optional(),
  parentId: z.uuid().optional(),
  projectId: z.uuid().optional(),
  context: contextEnum.optional(),
  labels: z.array(z.string().trim().min(1)).optional(),
  recurrenceRule: recurrenceRuleSchema.optional(),
})

export const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  estimatedMinutes: z.number().int().positive().nullable().optional(),
  projectId: z.uuid().nullable().optional(),
  context: contextEnum.optional(),
  labels: z.array(z.string().trim().min(1)).optional(),
  recurrenceRule: recurrenceRuleSchema.nullable().optional(),
})

export const listTasksQuerySchema = z.object({
  status: z
    .union([taskStatus, z.array(taskStatus)])
    .transform((v) => (Array.isArray(v) ? v : [v]))
    .optional(),
  q: z.string().optional(),
  label: z.string().optional(),
  hasEstimate: hasFlagSchema,
  hasDue: hasFlagSchema,
  context: contextEnum.optional(),
  projectId: z.uuid().optional(),
  parentId: z.uuid().optional(),
  descendantOf: z.uuid().optional(),
  includeAncestors: hasFlagSchema,
  sortBy: taskSortBy.optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
})
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>

export const treeQuerySchema = z.object({
  rootId: z.uuid().optional(),
  sortBy: taskListSortBy.optional(),
})

export const searchQuerySchema = z.object({
  q: z.string().optional(),
  status: taskStatus.optional(),
  label: z.string().optional(),
  context: contextEnum.optional(),
  hasEstimate: hasFlagSchema,
  hasDue: hasFlagSchema,
  sortBy: taskSortBy.optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
})
