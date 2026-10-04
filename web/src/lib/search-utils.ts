import type { InferResponseType } from 'hono/client'

import { api } from '#lib/api'

type SearchResult = InferResponseType<typeof api.api.tasks.$get, 200>[number]
type TaskDetail = InferResponseType<(typeof api.api.tasks)[':id']['$get'], 200>

export function extractTaskNumber(query: string): string | undefined {
  return /^#?(\d+)$/.exec(query)?.[1]
}

export function taskDetailToSearchResult(task: TaskDetail): SearchResult {
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
    remindAt: task.remindAt,
    parentId: task.parentId,
    parentNumber: task.parentNumber,
    projectId: task.projectId,
    recurrenceRuleId: task.recurrenceRuleId,
    recurrenceRule: task.recurrenceRule,
    templateId: task.templateId,
    occurrenceDate: task.occurrenceDate,
    githubLinks: task.githubLinks,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    childCompletionCount: task.childCompletionCount,
    duplicateOfNumber: task.duplicateOfNumber ?? null,
    blockedByNumbers: task.blockedBy.map(({ number }) => number),
  }
}
