import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { Hono } from 'hono'
import { z } from 'zod'

// Matches the shape of an individual Zod issue as embedded in the JSON
// string that `@hono/zod-validator`'s default (no-hook) error response
// puts in `error.message`.
const zodIssueSchema = z.object({
  path: z.array(z.union([z.string(), z.number()])),
  message: z.string(),
})

const validationErrorBodySchema = z.object({
  error: z.object({ message: z.string() }),
})

// Matches routes' hand-written client-error bodies, e.g. `{ error: 'Task not
// found' }` (404) or `{ error: 'Task is already completed' }` (409).
const clientErrorBodySchema = z.object({ error: z.string() })

export type RouteCallResult<T> =
  { ok: true; data: T } | { ok: false; result: CallToolResult }

/**
 * Calls an existing route in-process via `app.request()` and maps the HTTP
 * response to an MCP tool result. Non-2xx responses become a `CallToolResult`
 * with `isError: true` so the agent sees a normal tool result it can react
 * to, rather than a protocol-level error.
 */
export async function callInternalRoute<T = unknown>(
  app: Hono,
  path: string,
  init?: RequestInit,
): Promise<RouteCallResult<T>> {
  const res = await app.request(path, init)

  if (res.ok) {
    // Routes without a response body (e.g. DELETE endpoints) return 204.
    const data = res.status === 204 ? undefined : await res.json()
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- the caller specifies T based on which route it's calling; the response body isn't validated against it here
    return { ok: true, data: data as T }
  }

  return { ok: false, result: await toErrorResult(res) }
}

async function toErrorResult(res: Response): Promise<CallToolResult> {
  if (res.status === 400) {
    return errorResult(await formatValidationMessage(res))
  }
  if (res.status >= 500) {
    return errorResult(
      'An internal error occurred while processing the request.',
    )
  }
  return errorResult(await formatClientErrorMessage(res))
}

async function formatClientErrorMessage(res: Response): Promise<string> {
  const parsed = clientErrorBodySchema.safeParse(await readJson(res))
  return parsed.success
    ? parsed.data.error
    : 'The request could not be completed.'
}

async function formatValidationMessage(res: Response): Promise<string> {
  const body = validationErrorBodySchema.safeParse(await readJson(res))
  if (!body.success) {
    return 'The request was invalid.'
  }

  const issues = z
    .array(zodIssueSchema)
    .safeParse(safeJsonParse(body.data.error.message))
  if (!issues.success || issues.data.length === 0) {
    return 'The request was invalid.'
  }

  const details = issues.data
    .map(
      (issue) =>
        `${issue.path.length > 0 ? issue.path.join('.') : '(root)'}: ${issue.message}`,
    )
    .join('; ')
  return `Invalid request: ${details}`
}

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json()
  } catch {
    return undefined
  }
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

function errorResult(message: string): CallToolResult {
  return { isError: true, content: [{ type: 'text', text: message }] }
}
