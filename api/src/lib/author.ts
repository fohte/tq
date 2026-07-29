import type { MiddlewareHandler } from 'hono'
import { z } from 'zod'

export type Author =
  { kind: 'human'; agent: null } | { kind: 'llm'; agent: string }

export const AUTHOR_HEADER = 'X-Author'

// `system` is intentionally not accepted here: it's reserved for edits the
// server makes on its own behalf (e.g. recurring task generation) and must
// never be settable by a client.
const authorHeaderSchema = z.union([
  z.literal('human').transform((): Author => ({ kind: 'human', agent: null })),
  z
    .string()
    .regex(/^llm:.+$/)
    .transform((value): Author => ({
      kind: 'llm',
      agent: value.slice('llm:'.length),
    })),
])

declare module 'hono' {
  interface ContextVariableMap {
    author: Author
  }
}

// Clients self-report the author of each write via this header; it is not
// cryptographically verified (this is a personal tool behind Cloudflare
// Access, not a multi-tenant trust boundary). Falls back to 'human' when
// absent, for web's existing requests and curl/dev convenience.
export const authorMiddleware: MiddlewareHandler = async (c, next) => {
  const raw = c.req.header(AUTHOR_HEADER) ?? 'human'
  const result = authorHeaderSchema.safeParse(raw)
  if (!result.success) {
    return c.json({ error: `Invalid ${AUTHOR_HEADER} header` }, 400)
  }
  c.set('author', result.data)
  return next()
}
