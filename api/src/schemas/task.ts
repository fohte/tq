import { z } from 'zod'

import { MAX_MARKDOWN_CONTENT_LENGTH } from '#constants/content-length'
import { taskIdOrNumber } from '#lib/numeric-id'
import { labelNameSchema } from '#schemas/label-name'
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
  labels: z.array(labelNameSchema).optional(),
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
  labels: z.array(labelNameSchema).optional(),
  recurrenceRule: recurrenceRuleSchema.nullable().optional(),
  remindAt: z.iso
    .datetime({ offset: true })
    .nullable()
    .optional()
    .describe(
      'When to send a push notification about this task (ISO 8601), or ' +
        'null to cancel a pending one. Reads back as null once the ' +
        'reminder has been delivered, or dropped undelivered because the ' +
        'task was no longer todo or was more than an hour overdue.',
    ),
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
  templateId: z.uuid().optional(),
  parentId: z.union([z.literal('root'), z.uuid()]).optional(),
  descendantOf: z.uuid().optional(),
  includeAncestors: hasFlagSchema,
  sortBy: taskSortBy.optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
})
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>
