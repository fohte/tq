import { errAsync, okAsync, ResultAsync } from 'neverthrow'

import { TQ_ORIGIN } from '#config'
import { openTqLinkInApp } from '#open-in-app'

export interface LinkedTask {
  id: string
  number: number
}

export interface LookupMessage {
  type: 'lookup'
  url: string
}

export interface CreateMessage {
  type: 'create'
  url: string
}

export type LookupResult = { ok: true; task: LinkedTask | null } | { ok: false }
export type CreateResult = { ok: true; task: LinkedTask } | { ok: false }

function hasTypeAndUrl<T extends string>(
  message: unknown,
  type: T,
): message is { type: T; url: string } {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as { type?: unknown }).type === type &&
    typeof (message as { url?: unknown }).url === 'string'
  )
}

export function isLookupMessage(message: unknown): message is LookupMessage {
  return hasTypeAndUrl(message, 'lookup')
}

export function isCreateMessage(message: unknown): message is CreateMessage {
  return hasTypeAndUrl(message, 'create')
}

interface LinkResponseBody {
  task: LinkedTask | null
}

interface CreateResponseBody {
  task: LinkedTask
}

export function lookupTask(
  url: string,
  fetchImpl: typeof fetch = fetch,
): ResultAsync<LinkedTask | null, Error> {
  return ResultAsync.fromPromise(
    fetchImpl(`${TQ_ORIGIN}/api/github/link?url=${encodeURIComponent(url)}`, {
      credentials: 'include',
    }),
    (cause) => new Error('tq lookup request failed', { cause }),
  )
    .andThen((res) =>
      res.ok
        ? okAsync(res)
        : errAsync(
            new Error(`tq lookup returned status ${String(res.status)}`),
          ),
    )
    .andThen((res) =>
      ResultAsync.fromPromise(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- the res.ok check above is the runtime guarantee for this endpoint's documented response shape (api/src/routes/github.ts's GET /link)
        res.json() as Promise<LinkResponseBody>,
        (cause) => new Error('failed to parse tq lookup response', { cause }),
      ),
    )
    .map((body) =>
      body.task ? { id: body.task.id, number: body.task.number } : null,
    )
}

export function createTask(
  url: string,
  fetchImpl: typeof fetch = fetch,
): ResultAsync<LinkedTask, Error> {
  return ResultAsync.fromPromise(
    fetchImpl(`${TQ_ORIGIN}/api/tasks/from-github`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    }),
    (cause) => new Error('tq create request failed', { cause }),
  )
    .andThen((res) =>
      res.ok
        ? okAsync(res)
        : errAsync(
            new Error(`tq create returned status ${String(res.status)}`),
          ),
    )
    .andThen((res) =>
      ResultAsync.fromPromise(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- the res.ok check above is the runtime guarantee for this endpoint's documented response shape (api/src/routes/tasks/github.ts's POST /from-github)
        res.json() as Promise<CreateResponseBody>,
        (cause) => new Error('failed to parse tq create response', { cause }),
      ),
    )
    .map((body) => ({ id: body.task.id, number: body.task.number }))
}

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse) => {
    if (isLookupMessage(message)) {
      void lookupTask(message.url).match(
        (task) => {
          sendResponse({ ok: true, task } satisfies LookupResult)
        },
        (error) => {
          console.warn('tq: lookup failed', error)
          sendResponse({ ok: false } satisfies LookupResult)
        },
      )
      return true
    }

    if (isCreateMessage(message)) {
      void createTask(message.url).match(
        (task) => {
          sendResponse({ ok: true, task } satisfies CreateResult)
        },
        (error) => {
          console.warn('tq: create failed', error)
          sendResponse({ ok: false } satisfies CreateResult)
        },
      )
      return true
    }

    return false
  },
)

chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  void openTqLinkInApp(details).match(
    () => undefined,
    (error) => {
      console.warn('tq: link handoff failed', error)
    },
  )
})
