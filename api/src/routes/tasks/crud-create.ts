import { zValidator } from '@hono/zod-validator'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'

import { db } from '#db/connection'
import {
  recurrenceRules,
  taskDescriptionTemplates,
  taskRelations,
  tasks,
} from '#db/schema'
import { setChangeEventTaskIds } from '#lib/change-events'
import { firstOrThrow } from '#lib/drizzle-utils'
import { recordEdit } from '#lib/edits'
import { githubLinkErrorResponse } from '#routes/github-link-error'
import { resolveCreateBlockedByInputs } from '#routes/tasks/blocked-by'
import { getTaskChangeEventIds } from '#routes/tasks/change-event-task-ids'
import { toTaskLinkSyncResponse } from '#routes/tasks/link-sync-response'
import { resolveParentId, taskToResponse } from '#routes/tasks/shared'
import { createTaskSchema } from '#schemas/task'
import type { CreateTaskResponse } from '#schemas/task-response'
import { createTemplateFromTaskFields } from '#services/recurring-task-templates'
import {
  checkTaskCreate,
  resolveTaskCreateTemplate,
  taskConventionViolationBody,
} from '#services/task-conventions'
import {
  insertTaskGithubBlockers,
  type PreparedGithubBlockers,
} from '#services/task-github-blockers'
import { syncTaskLabels } from '#services/task-labels'
import { syncTaskLinks } from '#services/task-links'

export const tasksCreateApp = new Hono().post(
  '/',
  zValidator('json', createTaskSchema),
  async (c) => {
    const input = c.req.valid('json')
    const author = c.get('author')

    const templateSelection = await resolveTaskCreateTemplate(author, {
      template: input.template,
    })
    const conventionViolation = checkTaskCreate(author, {
      template: templateSelection,
      description: input.description,
    })
    if (conventionViolation !== null) {
      return c.json(
        taskConventionViolationBody(conventionViolation, 'creation'),
        400,
      )
    }
    let parentId: string | null = null
    if (input.parentId != null) {
      const resolved = await resolveParentId(input.parentId)
      if ('error' in resolved) {
        return c.json(resolved.error.body, resolved.error.status)
      }
      parentId = resolved.id
    }

    let blockedByTargetIds: string[] = []
    let githubBlockers: PreparedGithubBlockers | undefined
    if (input.blockedBy != null) {
      const resolved = await resolveCreateBlockedByInputs(input.blockedBy)
      if ('error' in resolved) {
        return c.json(resolved.error.body, resolved.error.status)
      }
      if ('githubError' in resolved) {
        return githubLinkErrorResponse(
          c,
          resolved.githubError,
          'tasks.blocked-by',
        )
      }
      blockedByTargetIds = resolved.targetIds
      githubBlockers = resolved.githubBlockers
    }

    const { task, createdRule, labelNames } = await db.transaction(
      async (tx) => {
        let descriptionTemplateId = templateSelection?.selected?.id ?? null
        if (descriptionTemplateId !== null) {
          // Keep deletion from racing between template selection and insertion.
          const [selectedTemplate] = await tx
            .select({ id: taskDescriptionTemplates.id })
            .from(taskDescriptionTemplates)
            .where(eq(taskDescriptionTemplates.id, descriptionTemplateId))
            .for('key share')
          descriptionTemplateId = selectedTemplate?.id ?? null
        }

        // Setting recurrence creates a template and links the task as its first instance.
        let templateFields: {
          templateId: string
          occurrenceDate: string
        } | null = null
        let createdRule: typeof recurrenceRules.$inferSelect | null = null
        if (input.recurrenceRule != null) {
          const created = await createTemplateFromTaskFields(
            tx,
            {
              title: input.title,
              description: input.description ?? null,
              projectId: input.projectId ?? null,
              parentId,
              context: input.context ?? 'personal',
              labels: input.labels ?? [],
            },
            {
              type: input.recurrenceRule.type,
              interval: input.recurrenceRule.interval,
              daysOfWeek: input.recurrenceRule.daysOfWeek ?? null,
              dayOfMonth: input.recurrenceRule.dayOfMonth ?? null,
            },
            input.startDate ?? null,
            input.dueDate ?? null,
          )
          createdRule = created.rule
          templateFields = {
            templateId: created.template.id,
            occurrenceDate: created.occurrenceDate,
          }
        }

        const task = firstOrThrow(
          await tx
            .insert(tasks)
            .values({
              title: input.title,
              description: input.description ?? null,
              descriptionTemplateId,
              startDate: input.startDate ?? null,
              dueDate: templateFields?.occurrenceDate ?? input.dueDate ?? null,
              parentId,
              projectId: input.projectId ?? null,
              context: input.context,
              commitment: input.commitment,
              templateId: templateFields?.templateId,
              occurrenceDate: templateFields?.occurrenceDate,
            })
            .returning(),
        )

        const labelNames =
          input.labels != null
            ? await syncTaskLabels(tx, task.id, input.labels, task.context)
            : []

        // Inserted directly (not via `syncTaskBlockedBy`) so a blocker
        // deleted between the existence check above and here aborts the
        // whole insert atomically instead of leaving an orphaned task with
        // a missing blocker. A cycle can't happen for a brand-new task, so
        // `syncTaskBlockedBy`'s advisory-lock/cycle check isn't needed here.
        if (blockedByTargetIds.length > 0) {
          await tx.insert(taskRelations).values(
            blockedByTargetIds.map((targetTaskId) => ({
              sourceTaskId: task.id,
              targetTaskId,
              type: 'blocked_by' as const,
            })),
          )
        }
        if (githubBlockers != null) {
          await insertTaskGithubBlockers(tx, task.id, githubBlockers.newIssues)
        }

        await recordEdit(tx, { taskId: task.id }, { action: 'create' }, author)

        return { task, createdRule, labelNames }
      },
    )

    const linkSync = await syncTaskLinks(task.id)
    setChangeEventTaskIds(
      c,
      await getTaskChangeEventIds([
        task.id,
        ...(parentId == null ? [] : [parentId]),
        ...blockedByTargetIds,
        ...linkSync.outgoing.map(({ id }) => id),
      ]),
    )

    const body = {
      ...taskToResponse(task, createdRule, [], labelNames),
      linkSync: toTaskLinkSyncResponse(linkSync),
    }
    // Keep the published schema and the handler response shape in sync.
    const schemaTypedBody: CreateTaskResponse = body
    const responseBody: typeof body = schemaTypedBody

    return c.json(responseBody, 201)
  },
)
