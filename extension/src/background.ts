import { errAsync, okAsync, ResultAsync } from 'neverthrow'

import { TQ_OPEN_IN_BROWSER_QUERY, TQ_ORIGIN } from '#config'
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

export interface OpenSignInMessage {
  type: 'open-sign-in'
}

export interface RefreshLookupMessage {
  type: 'refresh-lookup'
}

export type LookupResult =
  | { ok: true; task: LinkedTask | null }
  | { ok: false; reason?: 'authentication-required' }
export type CreateResult = { ok: true; task: LinkedTask } | { ok: false }

interface SignInFlow {
  sourceTabId: number
}

const SIGN_IN_TAB_STORAGE_PREFIX = 'tq-sign-in-tab:'

class AuthenticationRequiredError extends Error {
  constructor(message: string) {
    super(message)
    this.name = new.target.name
  }
}

function errorForStatus(status: number, message: string): Error {
  return status === 401 || status === 403
    ? new AuthenticationRequiredError(message)
    : new Error(message)
}

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

function isOpenSignInMessage(message: unknown): message is OpenSignInMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as { type?: unknown }).type === 'open-sign-in'
  )
}

function signInTabStorageKey(tabId: number): string {
  return `${SIGN_IN_TAB_STORAGE_PREFIX}${String(tabId)}`
}

function parseSignInFlow(value: unknown): SignInFlow | null {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('sourceTabId' in value) ||
    typeof value.sourceTabId !== 'number'
  ) {
    return null
  }

  return { sourceTabId: value.sourceTabId }
}

function isTqPageOutsideAccess(url: string): boolean {
  const origin = TQ_ORIGIN.endsWith('/') ? TQ_ORIGIN.slice(0, -1) : TQ_ORIGIN
  if (!url.startsWith(origin)) return false

  const suffix = url.slice(origin.length)
  if (
    suffix !== '' &&
    !suffix.startsWith('/') &&
    !suffix.startsWith('?') &&
    !suffix.startsWith('#')
  ) {
    return false
  }

  const path = suffix.split(/[?#]/u, 1)[0] ?? ''
  return path !== '/cdn-cgi' && !path.startsWith('/cdn-cgi/')
}

function openSignInTab(sourceTabId: number): ResultAsync<void, Error> {
  // Store the source tab before an existing Access session can commit tq.
  return ResultAsync.fromPromise(
    chrome.tabs.create({ url: 'about:blank', active: true }),
    (cause) => new Error('failed to open tq sign-in tab', { cause }),
  ).andThen((tab) => {
    const tabId = tab.id
    if (tabId === undefined) {
      return errAsync(new Error('tq sign-in tab has no id'))
    }

    const key = signInTabStorageKey(tabId)
    return ResultAsync.fromPromise(
      chrome.storage.session.set({ [key]: { sourceTabId } }),
      (cause) => new Error('failed to save tq sign-in tab state', { cause }),
    )
      .andThen(() =>
        ResultAsync.fromPromise(
          chrome.tabs.update(tabId, {
            url: `${TQ_ORIGIN}/?${TQ_OPEN_IN_BROWSER_QUERY}`,
          }),
          (cause) => new Error('failed to navigate to tq sign-in', { cause }),
        ).map(() => undefined),
      )
      .orElse((error) =>
        ResultAsync.fromPromise(
          Promise.allSettled([
            chrome.storage.session.remove(key),
            chrome.tabs.remove(tabId),
          ]),
          (cause) => new Error('failed to clean up tq sign-in tab', { cause }),
        )
          .map(() => undefined)
          .andThen(() => errAsync(error)),
      )
  })
}

function completeSignIn(
  details: chrome.webNavigation.WebNavigationBaseCallbackDetails,
): void {
  if (
    details.frameId !== 0 ||
    details.tabId < 0 ||
    !isTqPageOutsideAccess(details.url)
  ) {
    return
  }

  const key = signInTabStorageKey(details.tabId)
  void ResultAsync.fromPromise(
    chrome.storage.session.get(key),
    (cause) => new Error('failed to read tq sign-in tab state', { cause }),
  )
    .andThen((stored) => {
      const flow = parseSignInFlow(stored[key])
      if (flow === null) return okAsync(undefined)

      return ResultAsync.fromPromise(
        chrome.tabs.remove(details.tabId),
        (cause) => new Error('failed to close tq sign-in tab', { cause }),
      )
        .andThen(() =>
          ResultAsync.fromPromise(
            chrome.storage.session.remove(key),
            (cause) =>
              new Error('failed to remove tq sign-in tab state', { cause }),
          ),
        )
        .andThen(() =>
          ResultAsync.fromPromise(
            chrome.tabs.sendMessage(flow.sourceTabId, {
              type: 'refresh-lookup',
            } satisfies RefreshLookupMessage),
            (cause) => new Error('failed to refresh GitHub tq chip', { cause }),
          ),
        )
        .map(() => undefined)
    })
    .match(
      () => undefined,
      (error) => {
        console.warn('tq: sign-in completion failed', error)
      },
    )
}

interface LinkResponseBody {
  task: LinkedTask | null
}

interface CreateResponseBody {
  task: LinkedTask
}

function fetchLookupResponse(
  url: string,
  fetchImpl: typeof fetch,
): ResultAsync<Response, Error> {
  const endpoint = `${TQ_ORIGIN}/api/github/link?url=${encodeURIComponent(url)}`

  // A manual retry exposes Access redirects as opaque responses without
  // treating ordinary network failures as authentication failures.
  return ResultAsync.fromPromise(
    fetchImpl(endpoint, { credentials: 'include' }),
    (cause) => new Error('tq lookup request failed', { cause }),
  ).orElse((error) =>
    ResultAsync.fromPromise(
      fetchImpl(endpoint, { credentials: 'include', redirect: 'manual' }),
      () => error,
    ).andThen((res) => {
      if (res.type === 'opaqueredirect') {
        return errAsync(
          new AuthenticationRequiredError(
            'tq lookup redirected to Cloudflare Access',
          ),
        )
      }

      return res.status === 401 || res.status === 403
        ? errAsync(
            errorForStatus(
              res.status,
              `tq lookup returned status ${String(res.status)}`,
            ),
          )
        : errAsync(error)
    }),
  )
}

export function lookupTask(
  url: string,
  fetchImpl: typeof fetch = fetch,
): ResultAsync<LinkedTask | null, Error> {
  return fetchLookupResponse(url, fetchImpl)
    .andThen((res) =>
      res.ok
        ? okAsync(res)
        : errAsync(
            errorForStatus(
              res.status,
              `tq lookup returned status ${String(res.status)}`,
            ),
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
            errorForStatus(
              res.status,
              `tq create returned status ${String(res.status)}`,
            ),
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
  (message: unknown, sender, sendResponse) => {
    if (isOpenSignInMessage(message)) {
      const sourceTabId = sender.tab?.id
      if (sourceTabId === undefined) return false

      void openSignInTab(sourceTabId).match(
        () => {
          sendResponse({ ok: true })
        },
        (error) => {
          console.warn('tq: sign-in tab failed', error)
          sendResponse({ ok: false })
        },
      )
      return true
    }

    if (isLookupMessage(message)) {
      void lookupTask(message.url).match(
        (task) => {
          sendResponse({ ok: true, task } satisfies LookupResult)
        },
        (error) => {
          console.warn('tq: lookup failed', error)
          sendResponse(
            error instanceof AuthenticationRequiredError
              ? ({
                  ok: false,
                  reason: 'authentication-required',
                } satisfies LookupResult)
              : ({ ok: false } satisfies LookupResult),
          )
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

chrome.webNavigation.onCommitted.addListener(completeSignIn)
