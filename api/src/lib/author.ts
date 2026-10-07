import type { MiddlewareHandler } from 'hono'
import { z } from 'zod'

export type Author =
  { kind: 'human'; agent: null } | { kind: 'llm'; agent: string }

export const AUTHOR_HEADER = 'X-Author'

type ParsedAuthorHeader = { author: Author; origin: string | null }

// `system` is intentionally not accepted here: it's reserved for edits the
// server makes on its own behalf (e.g. recurring task generation) and must
// never be settable by a client.
const authorHeaderSchema = z.union([
  z.literal('human').transform((): ParsedAuthorHeader => ({
    author: { kind: 'human', agent: null },
    origin: null,
  })),
  z
    .string()
    .regex(/^human:.+$/)
    .transform((value): ParsedAuthorHeader => ({
      author: { kind: 'human', agent: null },
      origin: value.slice('human:'.length),
    })),
  z
    .string()
    .regex(/^llm:.+$/)
    .transform((value): ParsedAuthorHeader => ({
      author: {
        kind: 'llm',
        agent: value.slice('llm:'.length),
      },
      origin: null,
    })),
])

declare module 'hono' {
  interface ContextVariableMap {
    author: Author
    origin: string | null
  }
}

// Clients self-report the author of each write via this header; it is not
// cryptographically verified (this is a personal tool behind Cloudflare
// Access, not a multi-tenant trust boundary). Web clients append their screen
// ID to `human:` so change events can be ignored by their originating screen.
export const authorMiddleware: MiddlewareHandler = async (c, next) => {
  const raw = c.req.header(AUTHOR_HEADER) ?? 'human'
  const result = authorHeaderSchema.safeParse(raw)
  if (!result.success) {
    return c.json({ error: `Invalid ${AUTHOR_HEADER} header` }, 400)
  }
  c.set('author', result.data.author)
  c.set('origin', result.data.origin)
  return next()
}
