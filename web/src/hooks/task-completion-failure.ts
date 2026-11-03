import { errAsync, ResultAsync } from 'neverthrow'

import { unwrapOrThrow } from '#lib/assert-response'

export interface TaskCompletionGithubBlocker {
  owner: string
  repo: string
  number: number
  url: string
}

export interface TaskCompletionWaitBlocker {
  id: string
  label: string
  followUpDate: string
  githubLinkId: string | null
  resolvedAt: string | null
  acknowledgedAt: string | null
}

export interface TaskCompletionBlockers {
  blockedByNumbers: number[]
  blockedByGithubRefs: TaskCompletionGithubBlocker[]
  blockedByWaits: TaskCompletionWaitBlocker[]
}

export interface TaskCompletionRequest {
  kind: 'status' | 'complete'
  id: string
  taskNumber?: number
  statusReason?: 'completed' | 'not_planned' | 'duplicate'
  duplicateOfTaskId?: string
}

type CompletionRequestMetadata = {
  id: string
  taskNumber?: number | undefined
  statusReason?: TaskCompletionRequest['statusReason'] | undefined
  duplicateOfTaskId?: string | undefined
}

export interface TaskCompletionFailure {
  id: string
  request: TaskCompletionRequest
  message: string
  blockers: TaskCompletionBlockers | null
}

export class TaskCompletionError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly blockers: TaskCompletionBlockers | null,
  ) {
    super(message)
    this.name = 'TaskCompletionError'
  }
}

const taskCompletionFailureListeners = new Set<() => void>()
let taskCompletionFailure: TaskCompletionFailure | null = null

export function subscribeTaskCompletionFailure(listener: () => void) {
  taskCompletionFailureListeners.add(listener)
  return () => {
    taskCompletionFailureListeners.delete(listener)
  }
}

export function getTaskCompletionFailureSnapshot() {
  return taskCompletionFailure
}

export function createTaskCompletionRequest(
  kind: TaskCompletionRequest['kind'],
  {
    id,
    taskNumber,
    statusReason,
    duplicateOfTaskId,
  }: CompletionRequestMetadata,
): TaskCompletionRequest {
  return {
    kind,
    id,
    ...(taskNumber == null ? {} : { taskNumber }),
    ...(statusReason == null ? {} : { statusReason }),
    ...(duplicateOfTaskId == null ? {} : { duplicateOfTaskId }),
  }
}

export function dismissTaskCompletionFailure(failureId: string) {
  if (taskCompletionFailure?.id !== failureId) return
  taskCompletionFailure = null
  for (const listener of taskCompletionFailureListeners) listener()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isGithubBlocker(value: unknown): value is TaskCompletionGithubBlocker {
  return (
    isRecord(value) &&
    typeof value['owner'] === 'string' &&
    typeof value['repo'] === 'string' &&
    typeof value['number'] === 'number' &&
    typeof value['url'] === 'string'
  )
}

function isWaitBlocker(value: unknown): value is TaskCompletionWaitBlocker {
  return (
    isRecord(value) &&
    typeof value['id'] === 'string' &&
    typeof value['label'] === 'string' &&
    typeof value['followUpDate'] === 'string' &&
    (typeof value['githubLinkId'] === 'string' ||
      value['githubLinkId'] === null) &&
    (typeof value['resolvedAt'] === 'string' || value['resolvedAt'] === null) &&
    (typeof value['acknowledgedAt'] === 'string' ||
      value['acknowledgedAt'] === null)
  )
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'number')
}

function isGithubBlockerArray(
  value: unknown,
): value is TaskCompletionGithubBlocker[] {
  return Array.isArray(value) && value.every(isGithubBlocker)
}

function isWaitBlockerArray(
  value: unknown,
): value is TaskCompletionWaitBlocker[] {
  return Array.isArray(value) && value.every(isWaitBlocker)
}

function parseBlockers(body: unknown): TaskCompletionBlockers | null {
  if (!isRecord(body)) return null
  const blockedByNumbers = body['blockedByNumbers']
  const blockedByGithubRefs = body['blockedByGithubRefs']
  const blockedByWaits = body['blockedByWaits']
  if (
    !isNumberArray(blockedByNumbers) ||
    !isGithubBlockerArray(blockedByGithubRefs) ||
    (blockedByWaits !== undefined && !isWaitBlockerArray(blockedByWaits))
  ) {
    return null
  }

  return {
    blockedByNumbers,
    blockedByGithubRefs,
    blockedByWaits: blockedByWaits ?? [],
  }
}

function getErrorMessage(body: unknown, status: number): string {
  if (isRecord(body) && typeof body['error'] === 'string') return body['error']
  return `The server returned an error (${String(status)}).`
}

export async function assertTaskCompletionOk(response: {
  status: number
  ok: boolean
  json: () => Promise<unknown>
}): Promise<void> {
  if (response.ok) return

  const failure = await ResultAsync.fromPromise(
    response.json(),
    () =>
      new TaskCompletionError(
        `The server returned an error (${String(response.status)}).`,
        response.status,
        null,
      ),
  ).andThen((body) => {
    const blockers = response.status === 409 ? parseBlockers(body) : null
    return errAsync(
      new TaskCompletionError(
        getErrorMessage(body, response.status),
        response.status,
        blockers,
      ),
    )
  })

  return unwrapOrThrow(failure)
}

export function notifyTaskCompletionFailed(
  request: TaskCompletionRequest,
  error: unknown,
): void {
  const message = error instanceof Error ? error.message : 'Request failed.'
  taskCompletionFailure = {
    id: crypto.randomUUID(),
    request,
    message,
    blockers: error instanceof TaskCompletionError ? error.blockers : null,
  }
  for (const listener of taskCompletionFailureListeners) listener()
}
