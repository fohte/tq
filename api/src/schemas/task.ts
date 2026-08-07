import { z } from 'zod'

import { recurrenceRuleSchema } from '#schemas/recurrence-rule'

export const taskStatus = z.enum(['todo', 'in_progress', 'completed'])
export const contextEnum = z.enum(['work', 'personal'])

export const taskListSortBy = z.enum(['created', 'updated'])
export type TaskListSortBy = z.infer<typeof taskListSortBy>

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
  status: taskStatus.optional(),
  projectId: z.uuid().optional(),
  parentId: z.uuid().optional(),
  context: contextEnum.optional(),
  sortBy: taskListSortBy.optional(),
})

export const treeQuerySchema = z.object({
  rootId: z.uuid().optional(),
  sortBy: taskListSortBy.optional(),
})

export const searchQuerySchema = z.object({
  q: z.string().optional(),
  status: taskStatus.optional(),
  label: z.string().optional(),
  context: contextEnum.optional(),
  hasEstimate: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
  hasDue: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
  sortBy: z.enum(['due', 'created', 'updated', 'estimate']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
})
