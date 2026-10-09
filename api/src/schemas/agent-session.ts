import { z } from 'zod'

export const agentProviderSchema = z.enum(['claude_code', 'codex'])
export type AgentProvider = z.infer<typeof agentProviderSchema>

export const upsertAgentSessionSchema = z.object({
  provider: agentProviderSchema,
  sessionId: z.string().min(1),
  cwd: z.string().min(1),
  context: z.enum(['work', 'personal']).optional(),
  // Only takes effect on this session's first report (see
  // agent-sessions.ts); a later report never clears an already-recorded parent.
  parentSessionId: z.string().min(1).optional(),
  label: z.string().nullable(),
  lastMessage: z.string().nullable(),
  ended: z.boolean().optional(),
})

// `null` clears the override and falls back to the hook-reported `label`.
export const updateAgentSessionSchema = z.object({
  customLabel: z.string().trim().min(1).nullable(),
})

const sessionIdFilterSchema = z
  .union([z.string(), z.array(z.string())])
  .transform((v) => (Array.isArray(v) ? v : [v]))
  .optional()

const taskIdsFilterSchema = z.union([
  z.literal('all'),
  z
    .union([z.uuid(), z.array(z.uuid())])
    .transform((v) => (Array.isArray(v) ? v : [v])),
])

const listAgentSessionsLimitSchema = z.union([
  z.literal('unlimited'),
  z.coerce.number().int().min(1).max(100),
])

export const listAgentSessionsQuerySchema = z.object({
  sessionId: sessionIdFilterSchema,
  limit: listAgentSessionsLimitSchema,
})

export const listAgentSessionsByTaskQuerySchema = z.object({
  sessionId: sessionIdFilterSchema,
  taskIds: taskIdsFilterSchema,
  active: z.enum(['true', 'all']),
  limit: listAgentSessionsLimitSchema,
})
