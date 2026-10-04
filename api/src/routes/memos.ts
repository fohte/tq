import { zValidator } from '@hono/zod-validator'
import { and, eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'

import { db } from '#db/connection'
import { memos } from '#db/schema'
import { memoContextParamsSchema, updateMemoSchema } from '#schemas/memo'

function memoToResponse(
  memo: typeof memos.$inferSelect | undefined,
  context: 'work' | 'personal',
) {
  return {
    context,
    content: memo?.content ?? '',
    revision: memo?.revision ?? 0,
    updatedAt: memo?.updatedAt.toISOString() ?? null,
  }
}

export const memosApp = new Hono()
  .get('/:context', zValidator('param', memoContextParamsSchema), async (c) => {
    const { context } = c.req.valid('param')
    const memo = await db.query.memos.findFirst({
      where: eq(memos.context, context),
    })

    return c.json(memoToResponse(memo, context), 200)
  })
  .put(
    '/:context',
    zValidator('param', memoContextParamsSchema),
    zValidator('json', updateMemoSchema),
    async (c) => {
      const { context } = c.req.valid('param')
      const input = c.req.valid('json')

      const [updated] =
        input.revision === 0
          ? await db
              .insert(memos)
              .values({
                context,
                content: input.content,
                revision: 1,
                updatedAt: new Date(),
              })
              .onConflictDoUpdate({
                target: memos.context,
                set: {
                  content: input.content,
                  revision: sql`${memos.revision} + 1`,
                  updatedAt: new Date(),
                },
                setWhere: eq(memos.revision, input.revision),
              })
              .returning()
          : await db
              .update(memos)
              .set({
                content: input.content,
                revision: sql`${memos.revision} + 1`,
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(memos.context, context),
                  eq(memos.revision, input.revision),
                ),
              )
              .returning()

      if (!updated) {
        return c.json(
          {
            error:
              'Memo has changed; fetch the latest revision before updating',
          },
          409,
        )
      }

      return c.json(memoToResponse(updated, context), 200)
    },
  )
