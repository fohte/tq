import { z } from 'zod'

import { GITHUB_LINK_ROLES, GITHUB_NOTIFY_EVENTS } from '#db/schema'
import {
  commitmentEnum,
  contextEnum,
  taskStatus,
  taskStatusReason,
} from '#schemas/task'

const recurrenceRuleResponseSchema = z.object({
  id: z.uuid(),
  type: z.enum(['daily', 'weekly', 'monthly', 'custom']),
  interval: z.number().int().min(1),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).nullable(),
  dayOfMonth: z.number().int().min(1).max(31).nullable(),
})

const githubLinkResponseSchema = z.object({
  id: z.uuid(),
  owner: z.string(),
  repo: z.string(),
  number: z.number().int(),
  kind: z.enum(['issue', 'pull_request']),
  role: z.enum(GITHUB_LINK_ROLES),
  notifyEvents: z.array(z.enum(GITHUB_NOTIFY_EVENTS)),
  url: z.url(),
  state: z.enum(['open', 'closed', 'merged']),
  title: z.string(),
  lastSyncedAt: z.iso.datetime(),
})

const linkedTaskResponseSchema = z.object({
  id: z.uuid(),
  number: z.number().int(),
  title: z.string(),
  status: taskStatus,
})

const refSourceResponseSchema = z.union([
  z.object({ kind: z.literal('description') }),
  z.object({ kind: z.literal('page'), id: z.uuid(), title: z.string() }),
  z.object({ kind: z.literal('comment'), id: z.uuid() }),
])

const linkSyncResponseSchema = z.object({
  outgoing: z.array(linkedTaskResponseSchema),
  unresolvedRefs: z.array(
    z.union([
      z.object({
        kind: z.literal('number'),
        value: z.number().int(),
        sources: z.array(refSourceResponseSchema),
      }),
      z.object({
        kind: z.literal('id'),
        value: z.string(),
        sources: z.array(refSourceResponseSchema),
      }),
    ]),
  ),
})

export const createTaskResponseSchema = z.object({
  id: z.uuid(),
  number: z.number().int(),
  title: z.string(),
  description: z.string().nullable(),
  status: taskStatus,
  statusReason: taskStatusReason.nullable(),
  context: contextEnum,
  commitment: commitmentEnum,
  labels: z.array(z.string()),
  startDate: z.string().nullable(),
  dueDate: z.string().nullable(),
  remindAt: z.iso.datetime().nullable(),
  parentId: z.uuid().nullable(),
  projectId: z.uuid().nullable(),
  recurrenceRuleId: z.uuid().nullable(),
  recurrenceRule: recurrenceRuleResponseSchema.nullable(),
  templateId: z.uuid().nullable(),
  occurrenceDate: z.iso.date().nullable(),
  githubLinks: z.array(githubLinkResponseSchema),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  linkSync: linkSyncResponseSchema,
})

export type CreateTaskResponse = z.output<typeof createTaskResponseSchema>
