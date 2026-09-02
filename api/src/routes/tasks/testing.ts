import { asc, eq } from 'drizzle-orm'
import { expect } from 'vitest'
import { z } from 'zod'

import { app } from '#app'
import { db } from '#db/connection'
import { labels, taskEvents } from '#db/schema'
import { firstOrThrow } from '#lib/drizzle-utils'
import type { TaskStatusReason } from '#schemas/task'
import { taskStatusReason } from '#schemas/task'
import { jsonBody } from '#testing'

export interface TimeBlockResponse {
  id: string
  taskId: string
  startTime: string
  endTime: string
  isAutoScheduled: boolean
  createdAt: string
  updatedAt: string
}

interface RecurrenceRuleResponse {
  id: string
  type: 'daily' | 'weekly' | 'monthly' | 'custom'
  interval: number
  daysOfWeek: number[] | null
  dayOfMonth: number | null
}

export interface LinkedTaskResponse {
  id: string
  number: number
  title: string
  status: 'todo' | 'completed'
}

type RefSourceResponse =
  | { kind: 'description' }
  | { kind: 'page'; id: string; title: string }
  | { kind: 'comment'; id: string }

export interface LinkSyncResponse {
  outgoing: LinkedTaskResponse[]
  unresolvedRefs: ((
    { kind: 'number'; value: number } | { kind: 'id'; value: string }
  ) & { sources: RefSourceResponse[] })[]
}

export interface GithubLinkResponse {
  id: string
  owner: string
  repo: string
  number: number
  kind: 'issue' | 'pull_request'
  url: string
  state: 'open' | 'closed' | 'merged'
  title: string
  lastSyncedAt: string
}

export interface TaskResponse {
  id: string
  number: number
  title: string
  description: string | null
  status: 'todo' | 'completed'
  statusReason: TaskStatusReason | null
  context: 'work' | 'personal'
  commitment: 'inbox' | 'active' | 'someday'
  labels: string[]
  startDate: string | null
  dueDate: string | null
  estimatedMinutes: number | null
  parentId: string | null
  projectId: string | null
  recurrenceRuleId: string | null
  recurrenceRule: RecurrenceRuleResponse | null
  githubLinks: GithubLinkResponse[]
  createdAt: string
  updatedAt: string
  childCompletionCount?: { completed: number; total: number }
  children?: TaskResponse[]
  links?: { outgoing: TaskListItemResponse[]; incoming: TaskListItemResponse[] }
  linkSync?: LinkSyncResponse
  // Only present on the single-task detail response (`GET /:id`), not on any
  // create/update mutation response.
  parentNumber?: number | null
  duplicateOfNumber?: number | null
  // Same shape as one entry of `links.outgoing`.
  duplicateOfTask?: TaskListItemResponse | null
  // Tasks that block this task / that this task blocks. Same shape as
  // `links.outgoing`/`links.incoming`; only present on the detail response.
  blockedBy?: TaskListItemResponse[]
  blocking?: TaskListItemResponse[]
}

// Shape returned by the list-returning endpoint (`/api/tasks`) and by a task
// detail's `links` field: no `recurrenceRule` key (unlike `TaskResponse`),
// plus `parentNumber`.
export interface TaskListItemResponse {
  id: string
  number: number
  title: string
  description: string | null
  status: 'todo' | 'completed'
  statusReason: TaskStatusReason | null
  context: 'work' | 'personal'
  commitment: 'inbox' | 'active' | 'someday'
  labels: string[]
  startDate: string | null
  dueDate: string | null
  estimatedMinutes: number | null
  parentId: string | null
  projectId: string | null
  recurrenceRuleId: string | null
  githubLinks: GithubLinkResponse[]
  createdAt: string
  updatedAt: string
  parentNumber: number | null
  duplicateOfNumber: number | null
  blockedByNumbers: number[]
  childCompletionCount?: { completed: number; total: number }
  children?: TaskListItemResponse[]
}

// List-endpoint responses have no `recurrenceRule` key at all, unlike
// `TaskResponse`, so building a list-item expectation out of a
// create/update response needs the key dropped rather than left behind as
// a stray `recurrenceRule: null`.
export function withoutRecurrenceRule<T extends { recurrenceRule: unknown }>(
  task: T,
): Omit<T, 'recurrenceRule'> {
  const { recurrenceRule, ...rest } = task
  void recurrenceRule
  return rest
}

// create/update responses carry a `linkSync` key (see
// api/src/services/task-links.ts); list/GET responses never do, so it must
// be dropped before comparing rather than left behind as a stray value.
export function withoutLinkSync<T extends { linkSync?: unknown }>(
  task: T,
): Omit<T, 'linkSync'> {
  const { linkSync, ...rest } = task
  void linkSync
  return rest
}

// The `TaskListItemResponse` shape of a task with no parent or duplicate-of
// relation, for building expected `links`/`blockedBy`/`blocking` entries from
// a `TaskResponse` without repeating its field list at each call site.
export function toListItemResponse(
  task: Pick<
    TaskResponse,
    | 'id'
    | 'number'
    | 'title'
    | 'description'
    | 'status'
    | 'statusReason'
    | 'context'
    | 'commitment'
    | 'labels'
    | 'startDate'
    | 'dueDate'
    | 'estimatedMinutes'
    | 'parentId'
    | 'projectId'
    | 'recurrenceRuleId'
    | 'githubLinks'
    | 'createdAt'
    | 'updatedAt'
  >,
  opts: {
    childCompletionCount?: { completed: number; total: number }
    blockedByNumbers?: number[]
  } = {},
): TaskListItemResponse {
  return {
    id: task.id,
    number: task.number,
    title: task.title,
    description: task.description,
    status: task.status,
    statusReason: task.statusReason,
    context: task.context,
    commitment: task.commitment,
    labels: task.labels,
    startDate: task.startDate,
    dueDate: task.dueDate,
    estimatedMinutes: task.estimatedMinutes,
    parentId: task.parentId,
    projectId: task.projectId,
    recurrenceRuleId: task.recurrenceRuleId,
    githubLinks: task.githubLinks,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    parentNumber: null,
    duplicateOfNumber: null,
    blockedByNumbers: opts.blockedByNumbers ?? [],
    childCompletionCount: opts.childCompletionCount ?? {
      completed: 0,
      total: 0,
    },
  }
}

const recurrenceRuleResponseSchema = z.object({
  id: z.string(),
  type: z.enum(['daily', 'weekly', 'monthly', 'custom']),
  interval: z.number(),
  daysOfWeek: z.array(z.number()).nullable(),
  dayOfMonth: z.number().nullable(),
})

const linkedTaskResponseSchema = z.object({
  id: z.string(),
  number: z.number(),
  title: z.string(),
  status: z.enum(['todo', 'completed']),
})

const refSourceResponseSchema = z.union([
  z.object({ kind: z.literal('description') }),
  z.object({ kind: z.literal('page'), id: z.string(), title: z.string() }),
  z.object({ kind: z.literal('comment'), id: z.string() }),
])

const linkSyncResponseSchema = z.object({
  outgoing: z.array(linkedTaskResponseSchema),
  unresolvedRefs: z.array(
    z.union([
      z.object({
        kind: z.literal('number'),
        value: z.number(),
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

const githubLinkResponseSchema = z.object({
  id: z.string(),
  owner: z.string(),
  repo: z.string(),
  number: z.number(),
  kind: z.enum(['issue', 'pull_request']),
  url: z.string(),
  state: z.enum(['open', 'closed', 'merged']),
  title: z.string(),
  lastSyncedAt: z.string(),
})

const taskListItemResponseSchema = z.object({
  id: z.string(),
  number: z.number(),
  title: z.string(),
  description: z.string().nullable(),
  status: z.enum(['todo', 'completed']),
  statusReason: taskStatusReason.nullable(),
  context: z.enum(['work', 'personal']),
  commitment: z.enum(['inbox', 'active', 'someday']),
  labels: z.array(z.string()),
  startDate: z.string().nullable(),
  dueDate: z.string().nullable(),
  estimatedMinutes: z.number().nullable(),
  parentId: z.string().nullable(),
  projectId: z.string().nullable(),
  recurrenceRuleId: z.string().nullable(),
  githubLinks: z.array(githubLinkResponseSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
  parentNumber: z.number().nullable(),
  duplicateOfNumber: z.number().nullable(),
  blockedByNumbers: z.array(z.number()),
  childCompletionCount: z
    .object({ completed: z.number(), total: z.number() })
    .optional(),
})

const taskResponseSchema = z.object({
  id: z.string(),
  number: z.number(),
  title: z.string(),
  description: z.string().nullable(),
  status: z.enum(['todo', 'completed']),
  statusReason: taskStatusReason.nullable(),
  context: z.enum(['work', 'personal']),
  commitment: z.enum(['inbox', 'active', 'someday']),
  labels: z.array(z.string()),
  startDate: z.string().nullable(),
  dueDate: z.string().nullable(),
  estimatedMinutes: z.number().nullable(),
  parentId: z.string().nullable(),
  projectId: z.string().nullable(),
  recurrenceRuleId: z.string().nullable(),
  recurrenceRule: recurrenceRuleResponseSchema.nullable(),
  githubLinks: z.array(githubLinkResponseSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
  childCompletionCount: z
    .object({ completed: z.number(), total: z.number() })
    .optional(),
  children: z.array(z.any()).optional(),
  links: z
    .object({
      outgoing: z.array(taskListItemResponseSchema),
      incoming: z.array(taskListItemResponseSchema),
    })
    .optional(),
  linkSync: linkSyncResponseSchema.optional(),
  parentNumber: z.number().nullable().optional(),
  duplicateOfNumber: z.number().nullable().optional(),
  duplicateOfTask: taskListItemResponseSchema.nullable().optional(),
  blockedBy: z.array(taskListItemResponseSchema).optional(),
  blocking: z.array(taskListItemResponseSchema).optional(),
})

const idResponseSchema = z.object({ id: z.string() })

export const TEST_UUID = '550e8400-e29b-41d4-a716-446655440000'

async function assertCreated(res: Response, label: string) {
  if (res.status !== 201) {
    expect(res.status, `${label}: ${await res.text()}`).toBe(201)
  }
}

export async function createTask(
  title: string,
  opts: {
    parentId?: string
    description?: string
    dueDate?: string
    estimatedMinutes?: number
    context?: string
    commitment?: string
    labels?: string[]
  } = {},
) {
  const res = await app.request('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, ...opts }),
  })
  await assertCreated(res, 'Failed to create task')
  return jsonBody(res, taskResponseSchema)
}

export async function createRecurringTask(
  title: string,
  recurrenceRule: {
    type: string
    interval: number
    daysOfWeek?: number[]
    dayOfMonth?: number
  },
  opts: {
    dueDate?: string
    description?: string
    estimatedMinutes?: number
    context?: string
  } = {},
) {
  const res = await app.request('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, recurrenceRule, ...opts }),
  })
  await assertCreated(res, 'Failed to create recurring task')
  return jsonBody(res, taskResponseSchema)
}

export async function createPage(
  taskId: string,
  title: string,
  content: string,
  opts: { format?: 'markdown' | 'html' } = {},
) {
  const res = await app.request(`/api/tasks/${taskId}/pages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, content, ...opts }),
  })
  await assertCreated(res, 'Failed to create page')
  return jsonBody(res, idResponseSchema)
}

export async function createComment(taskId: string, content: string) {
  const res = await app.request(`/api/tasks/${taskId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })
  await assertCreated(res, 'Failed to create comment')
  return jsonBody(res, idResponseSchema)
}

export async function createLabel(
  name: string,
  opts: { context?: 'work' | 'personal' } = {},
) {
  return firstOrThrow(
    await db.insert(labels).values({ name, context: opts.context }).returning(),
  )
}

export interface TaskEventFields {
  type: 'status_changed' | 'github_linked' | 'github_unlinked'
  fromStatus: 'todo' | 'in_progress' | 'completed' | null
  toStatus: 'todo' | 'in_progress' | 'completed' | null
  toStatusReason: TaskStatusReason | null
  githubOwner: string | null
  githubRepo: string | null
  githubNumber: number | null
  githubKind: 'issue' | 'pull_request' | null
  authorKind: 'human' | 'llm' | 'system'
  authorAgent: string | null
}

export async function fetchTaskEvents(
  taskId: string,
): Promise<TaskEventFields[]> {
  const rows = await db
    .select()
    .from(taskEvents)
    .where(eq(taskEvents.taskId, taskId))
    .orderBy(asc(taskEvents.id))
  return rows.map((row) => ({
    type: row.type,
    fromStatus: row.fromStatus,
    toStatus: row.toStatus,
    toStatusReason: row.toStatusReason,
    githubOwner: row.githubOwner,
    githubRepo: row.githubRepo,
    githubNumber: row.githubNumber,
    githubKind: row.githubKind,
    authorKind: row.authorKind,
    authorAgent: row.authorAgent,
  }))
}
