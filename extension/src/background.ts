import { errAsync, okAsync, ResultAsync } from 'neverthrow'

// Fetched from here, not from the content script, so the request runs from
// the extension's own origin instead of becoming a cross-origin request from
// github.com.
const TQ_API_ORIGIN = 'https://tq.fohte.net'

export interface LinkedTask {
  id: string
  number: number
}

export interface LookupMessage {
  type: 'lookup'
  url: string
}

export type LookupResult = { ok: true; task: LinkedTask | null } | { ok: false }

export function isLookupMessage(message: unknown): message is LookupMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as { type?: unknown }).type === 'lookup' &&
    typeof (message as { url?: unknown }).url === 'string'
  )
}

interface LinkResponseBody {
  task: LinkedTask | null
}

export function lookupTask(
  url: string,
  fetchImpl: typeof fetch = fetch,
): ResultAsync<LinkedTask | null, Error> {
  return ResultAsync.fromPromise(
    fetchImpl(
      `${TQ_API_ORIGIN}/api/github/link?url=${encodeURIComponent(url)}`,
      { credentials: 'include' },
    ),
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
    .map((body) => body.task)
}

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse) => {
    if (!isLookupMessage(message)) return false

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
  },
)
