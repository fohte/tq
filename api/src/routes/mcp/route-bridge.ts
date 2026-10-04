import type { CallToolResult } from '@modelcontextprotocol/server'
import { fromThrowable, ResultAsync } from 'neverthrow'
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

export async function toErrorResult(res: Response): Promise<CallToolResult> {
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
  const responseBody = await readJson(res)
  const body = validationErrorBodySchema.safeParse(responseBody)
  if (!body.success) {
    const clientError = clientErrorBodySchema.safeParse(responseBody)
    return clientError.success
      ? clientError.data.error
      : 'The request was invalid.'
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

function readJson(res: Response): Promise<unknown> {
  return ResultAsync.fromPromise(res.json(), () => undefined).unwrapOr(
    undefined,
  )
}

const tryParseJson = fromThrowable(
  (raw: string) => JSON.parse(raw) as unknown,
  () => undefined,
)

function safeJsonParse(raw: string): unknown {
  return tryParseJson(raw).unwrapOr(undefined)
}

function errorResult(message: string): CallToolResult {
  return { isError: true, content: [{ type: 'text', text: message }] }
}
