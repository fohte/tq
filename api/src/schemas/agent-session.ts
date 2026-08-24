import { z } from 'zod'

export const upsertAgentSessionSchema = z.object({
  provider: z.literal('claude_code'),
  sessionId: z.string().min(1),
  cwd: z.string().min(1),
  context: z.enum(['work', 'personal']).optional(),
  label: z.string().nullable(),
  lastMessage: z.string().nullable(),
  ended: z.boolean().optional(),
})

// `null` clears the override and falls back to the hook-reported `label`.
export const updateAgentSessionSchema = z.object({
  customLabel: z.string().trim().min(1).nullable(),
})
