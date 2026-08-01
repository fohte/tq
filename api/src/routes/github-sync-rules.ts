import { zValidator } from '@hono/zod-validator'
import { and, eq, isNull } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

import { db } from '#db/connection'
import { githubSyncRules } from '#db/schema'

const createSyncRuleSchema = z
  .object({
    scope: z.enum(['all', 'org', 'repo']),
    org: z.string().min(1).optional(),
    repo: z.string().min(1).optional(),
    targetProjectId: z.string().min(1),
    includeExisting: z.boolean().optional(),
  })
  .refine(
    (input) => {
      switch (input.scope) {
        case 'all':
          return input.org === undefined && input.repo === undefined
        case 'org':
          return input.org !== undefined && input.repo === undefined
        case 'repo':
          return input.org !== undefined && input.repo !== undefined
      }
    },
    {
      message:
        "scope 'all' must not set org/repo, 'org' requires org only, 'repo' requires both org and repo",
    },
  )

const updateSyncRuleSchema = z.object({
  enabled: z.boolean().optional(),
  targetProjectId: z.string().min(1).optional(),
})

// Which target project an (scope, org, repo) combination should sync into
// isn't defined if more than one enabled rule matches it, so the same
// combination may only have one enabled rule at a time.
function activeScopeConflictCondition(input: {
  scope: 'all' | 'org' | 'repo'
  org?: string | undefined
  repo?: string | undefined
}) {
  const org = input.org ?? null
  const repo = input.repo ?? null
  return and(
    eq(githubSyncRules.scope, input.scope),
    org === null ? isNull(githubSyncRules.org) : eq(githubSyncRules.org, org),
    repo === null
      ? isNull(githubSyncRules.repo)
      : eq(githubSyncRules.repo, repo),
    eq(githubSyncRules.enabled, true),
  )
}

function syncRuleToResponse(rule: typeof githubSyncRules.$inferSelect) {
  return {
    id: rule.id,
    scope: rule.scope,
    org: rule.org,
    repo: rule.repo,
    trigger: rule.trigger,
    targetProjectId: rule.targetProjectId,
    enabled: rule.enabled,
    createdAt: rule.createdAt.toISOString(),
    updatedAt: rule.updatedAt.toISOString(),
  }
}

export const githubSyncRulesApp = new Hono()
  .post('/', zValidator('json', createSyncRuleSchema), async (c) => {
    const input = c.req.valid('json')

    const conflicting = await db.query.githubSyncRules.findFirst({
      where: activeScopeConflictCondition(input),
    })
    if (conflicting) {
      return c.json(
        {
          error:
            'An enabled sync rule already exists for this scope (org/repo)',
        },
        409,
      )
    }

    const [rule] = await db
      .insert(githubSyncRules)
      .values({
        scope: input.scope,
        org: input.org ?? null,
        repo: input.repo ?? null,
        targetProjectId: input.targetProjectId,
        seedIgnoreOnNextSync: !(input.includeExisting ?? false),
      })
      .returning()

    if (!rule) {
      return c.json({ error: 'Failed to create GitHub sync rule' }, 500)
    }

    return c.json(syncRuleToResponse(rule), 201)
  })
  .get('/', async (c) => {
    const result = await db
      .select()
      .from(githubSyncRules)
      .orderBy(githubSyncRules.createdAt, githubSyncRules.seq)

    return c.json(result.map(syncRuleToResponse), 200)
  })
  .patch('/:id', zValidator('json', updateSyncRuleSchema), async (c) => {
    const id = c.req.param('id')

    const existing = await db.query.githubSyncRules.findFirst({
      where: eq(githubSyncRules.id, id),
    })
    if (!existing) {
      return c.json({ error: 'GitHub sync rule not found' }, 404)
    }

    const input = c.req.valid('json')

    const [updated] = await db
      .update(githubSyncRules)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(githubSyncRules.id, id))
      .returning()

    if (!updated) {
      return c.json({ error: 'GitHub sync rule not found' }, 404)
    }

    return c.json(syncRuleToResponse(updated), 200)
  })
  .delete('/:id', async (c) => {
    const id = c.req.param('id')

    const existing = await db.query.githubSyncRules.findFirst({
      where: eq(githubSyncRules.id, id),
    })
    if (!existing) {
      return c.json({ error: 'GitHub sync rule not found' }, 404)
    }

    // Cascade-deletes matching rows in github_sync_rule_ignored_issues (see
    // db/schema/integrations.ts's onDelete: 'cascade'); no explicit cleanup
    // needed here.
    await db.delete(githubSyncRules).where(eq(githubSyncRules.id, id))

    return c.body(null, 204)
  })
