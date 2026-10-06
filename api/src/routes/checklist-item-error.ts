import type { Context } from 'hono'

import { githubLinkErrorResponse } from '#routes/github-link-error'

export function checklistItemErrorResponse(
  c: Context,
  error: Error | { status: 400 | 404; message: string },
  fingerprintPrefix: string,
) {
  if (!(error instanceof Error)) {
    return c.json({ error: error.message }, error.status)
  }
  return githubLinkErrorResponse(c, error, fingerprintPrefix)
}
