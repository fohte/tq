import { matchAppResourceUrls } from 'api/lib/app-url'
import { isTaskIdentifier } from 'api/lib/task-identifier'
import type { InferResponseType } from 'hono/client'

import type { TaskWithDescription } from '#hooks/use-task-queries'
import { api } from '#lib/api'

type SearchResult = TaskWithDescription
type TaskDetail = InferResponseType<(typeof api.api.tasks)[':id']['$get'], 200>

export function extractTaskIdOrNumber(
  query: string,
  host: string,
): string | undefined {
  const numberMatch = /^#?(\d+)$/.exec(query)
  if (numberMatch != null) return numberMatch[1]

  const trimmedQuery = query.trim()
  const matches = matchAppResourceUrls(trimmedQuery, host, 'tasks')
  const [match] = matches
  if (match == null || match.start !== 0 || matches.length !== 1) {
    return undefined
  }

  const suffix = trimmedQuery.slice(match.end)
  if (suffix !== '' && !/^[?#][^\s]*$/.test(suffix)) return undefined
  return isTaskIdentifier(match.id) ? match.id : undefined
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
    checklistCompletionCount: task.checklistCompletionCount,
    duplicateOfNumber: task.duplicateOfNumber ?? null,
    blockedByNumbers: task.blockedBy.map(({ number }) => number),
    blockedByGithubRefs: task.githubBlockers
      .filter(({ state }) => state === 'open')
      .map(({ owner, repo, number, url }) => ({ owner, repo, number, url })),
  }
}
