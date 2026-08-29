import { z } from 'zod'

import {
  MAX_HTML_CONTENT_LENGTH,
  MAX_MARKDOWN_CONTENT_LENGTH,
} from '#constants/content-length'

const contentSchema = z
  .string()
  .describe(
    `Max ${String(MAX_MARKDOWN_CONTENT_LENGTH)} characters for format ` +
      `"markdown", ${String(MAX_HTML_CONTENT_LENGTH)} for format "html".`,
  )
  .optional()

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
  content: contentSchema,
  format: pageFormatSchema.optional(),
  sortOrder: z.number().int().optional(),
})

export const updatePageSchema = z.object({
  title: z.string().min(1).optional(),
  content: contentSchema,
  format: pageFormatSchema.optional(),
  sortOrder: z.number().int().optional(),
})
