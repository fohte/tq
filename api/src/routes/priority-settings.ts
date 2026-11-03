import { zValidator } from '@hono/zod-validator'
import { eq, isNull, sql } from 'drizzle-orm'
import { Hono } from 'hono'

import { db } from '#db/connection'
import { prioritySettings } from '#db/schema'
import { updatePrioritySettingsSchema } from '#schemas/priority-settings'
import { getPrioritySettings } from '#services/priority-settings'

export const prioritySettingsApp = new Hono()
  .get('/', async (c) => c.json(await getPrioritySettings(), 200))
  .put('/', zValidator('json', updatePrioritySettingsSchema), async (c) => {
    const settings = c.req.valid('json')
    const now = new Date()

    await db.transaction(async (tx) => {
      await tx
        .update(prioritySettings)
        .set({ sortOrder: sql`${prioritySettings.sortOrder} + 5` })

      for (const setting of settings) {
        await tx
          .update(prioritySettings)
          .set({ ...setting, updatedAt: now })
          .where(
            setting.priority === null
              ? isNull(prioritySettings.priority)
              : eq(prioritySettings.priority, setting.priority),
          )
      }
    })

    return c.json(await getPrioritySettings(), 200)
  })
