import { z } from 'zod'

export const upsertAgentSessionSchema = z.object({
  provider: z.literal('claude_code'),
  sessionId: z.string().min(1),
  cwd: z.string().min(1),
  context: z.enum(['work', 'personal']).optional(),
  // The parent's own sessionId, e.g. from TQ_PARENT_SESSION_ID for a
  // delegated/handed-off Claude Code session. Only takes effect on this
  // session's first report (see agent-sessions.ts), so a later report
  // omitting it never clears an already-recorded parent.
  parentSessionId: z.string().min(1).optional(),
  label: z.string().nullable(),
  lastMessage: z.string().nullable(),
  ended: z.boolean().optional(),
})

// `null` clears the override and falls back to the hook-reported `label`.
export const updateAgentSessionSchema = z.object({
  customLabel: z.string().trim().min(1).nullable(),
})
