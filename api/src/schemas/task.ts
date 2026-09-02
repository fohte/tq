import { z } from 'zod'

import { MAX_MARKDOWN_CONTENT_LENGTH } from '#constants/content-length'
import { taskIdOrNumber } from '#lib/numeric-id'
import { recurrenceRuleSchema } from '#schemas/recurrence-rule'

export const taskStatus = z.enum(['todo', 'completed'])
export type TaskStatus = z.infer<typeof taskStatus>
export const taskStatusReason = z.enum([
  'completed',
  'not_planned',
  'duplicate',
])
export type TaskStatusReason = z.infer<typeof taskStatusReason>
export const contextEnum = z.enum(['work', 'personal'])
export const commitmentEnum = z.enum(['inbox', 'active', 'someday'])

export const taskSortBy = z.enum(['created', 'updated', 'due', 'estimate'])
export type TaskSortBy = z.infer<typeof taskSortBy>

const hasFlagSchema = z
  .string()
  .transform((v) => v === 'true')
  .optional()

export const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().max(MAX_MARKDOWN_CONTENT_LENGTH).optional(),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  estimatedMinutes: z.number().int().positive().optional(),
  parentId: taskIdOrNumber.optional(),
  projectId: z.uuid().optional(),
  context: contextEnum.optional(),
  commitment: commitmentEnum.optional(),
  labels: z.array(z.string().trim().min(1)).optional(),
  recurrenceRule: recurrenceRuleSchema.optional(),
})

export const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z
    .string()
    .max(MAX_MARKDOWN_CONTENT_LENGTH)
    .nullable()
    .optional(),
  startDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  estimatedMinutes: z.number().int().positive().nullable().optional(),
  projectId: z.uuid().nullable().optional(),
  context: contextEnum.optional(),
  commitment: commitmentEnum.optional(),
  labels: z.array(z.string().trim().min(1)).optional(),
  recurrenceRule: recurrenceRuleSchema.nullable().optional(),
  // Full replacement, not add/remove: the complete desired set of blocker
  // tasks (id or number) each time. An empty array clears every
  // `blocked_by` relation.
  blockedBy: z.array(taskIdOrNumber).optional(),
})

export const listTasksQuerySchema = z.object({
  status: z
    .union([taskStatus, z.array(taskStatus)])
    .transform((v) => (Array.isArray(v) ? v : [v]))
    .optional(),
  statusReason: z
    .union([taskStatusReason, z.array(taskStatusReason)])
    .transform((v) => (Array.isArray(v) ? v : [v]))
    .optional(),
  q: z.string().optional(),
  label: z.string().optional(),
  hasEstimate: hasFlagSchema,
  hasDue: hasFlagSchema,
  context: contextEnum.optional(),
  commitment: commitmentEnum.optional(),
  projectId: z.uuid().optional(),
  parentId: z.union([z.literal('root'), z.uuid()]).optional(),
  descendantOf: z.uuid().optional(),
  includeAncestors: hasFlagSchema,
  sortBy: taskSortBy.optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
})
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>
