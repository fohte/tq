import { z } from 'zod'

const pageFormatSchema = z
  .enum(['markdown', 'html'])
  .describe(
    'Content format of this page. "markdown" (default) renders as ' +
      'formatted Markdown. "html" renders the content as a full HTML ' +
      "document inside a sandboxed iframe: it cannot access this app's " +
      'cookies, localStorage, or API (no same-origin access). Prefer ' +
      'inlining any CSS/JS rather than referencing external files, since ' +
      "there's no guarantee an external resource stays reachable when " +
      'the page is viewed later.',
  )

export const createPageSchema = z.object({
  title: z.string().min(1),
  content: z.string().optional(),
  format: pageFormatSchema.optional(),
  sortOrder: z.number().int().optional(),
})

export const updatePageSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().optional(),
  format: pageFormatSchema.optional(),
  sortOrder: z.number().int().optional(),
})
