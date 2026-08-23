import { z } from 'zod'

export const linkAgentSessionSchema = z.object({
  agentSessionId: z.string().min(1),
})
