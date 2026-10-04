import { z } from 'zod'

import { GITHUB_NOTIFY_EVENTS } from '#db/schema'

export const githubNotifyEventSchema = z.enum(GITHUB_NOTIFY_EVENTS)
export const githubNotifyEventsSchema = z.array(githubNotifyEventSchema)
