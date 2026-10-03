import { and, eq } from 'drizzle-orm'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { db } from '#db/connection'
import {
  defaultGithubNotifyEvents,
  githubSyncRuleIgnoredIssues,
  githubSyncRules,
  projects,
  taskGithubLinks,
  tasks,
} from '#db/schema'
import {
  mockAssignedIssuesResponse,
  upsertGithubToken,
} from '#integrations/github/testing'
import { firstOrThrow } from '#lib/drizzle-utils'
import { syncGithubAssignedIssues } from '#services/github-sync-rules'
import { assertDefined, setupTestDb } from '#testing'

setupTestDb()

afterEach(() => {
  vi.restoreAllMocks()
})

async function createProject(title: string) {
  return firstOrThrow(await db.insert(projects).values({ title }).returning())
}

function normalizeLink(link: typeof taskGithubLinks.$inferSelect) {
  return {
    ...link,
    id: 'ID',
    seq: 'SEQ',
    lastSyncedAt: 'DATE',
    createdAt: 'DATE',
    updatedAt: 'DATE',
  }
}

function normalizeTask(task: typeof tasks.$inferSelect) {
  return {
    ...task,
    id: 'ID',
    number: 'NUMBER',
    createdAt: 'DATE',
    updatedAt: 'DATE',
  }
}

async function createRule(
  targetProjectId: string,
  overrides: Partial<typeof githubSyncRules.$inferInsert> = {},
) {
  return firstOrThrow(
    await db
      .insert(githubSyncRules)
      .values({ scope: 'all', targetProjectId, ...overrides })
      .returning(),
  )
}

async function findLink(owner: string, repo: string, number: number) {
  return db.query.taskGithubLinks.findFirst({
    where: and(
      eq(taskGithubLinks.owner, owner),
      eq(taskGithubLinks.repo, repo),
      eq(taskGithubLinks.number, number),
      eq(taskGithubLinks.role, 'subject'),
    ),
  })
}

describe('syncGithubAssignedIssues', () => {
  it('creates and links a task for a newly assigned issue, under the rule target project', async () => {
    const project = await createProject('Inbox')
    await createRule(project.id)
    await upsertGithubToken('valid-token')
    mockAssignedIssuesResponse([
      {
        owner: 'fohte',
        repo: 'tq',
        number: 42,
        title: 'Fix bug',
        comments: 8,
        updatedAt: '2024-08-16T13:40:00Z',
        stateReason: 'reopened',
      },
    ])

    await syncGithubAssignedIssues()

    const link = await findLink('fohte', 'tq', 42)
    assertDefined(link)
    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, link.taskId),
    })
    assertDefined(task)

    expect(normalizeLink(link)).toEqual({
      id: 'ID',
      seq: 'SEQ',
      taskId: task.id,
      owner: 'fohte',
      repo: 'tq',
      number: 42,
      kind: 'issue',
      url: 'https://github.com/fohte/tq/issues/42',
      state: 'open',
      title: 'Fix bug',
      role: 'subject',
      notifyEvents: ['closed', 'reopened', 'comments', 'other'],
      commentsCount: 8,
      githubUpdatedAt: new Date('2024-08-16T13:40:00Z'),
      stateReason: 'reopened',
      etag: null,
      lastSyncedAt: 'DATE',
      createdAt: 'DATE',
      updatedAt: 'DATE',
    })
    expect(normalizeTask(task)).toEqual({
      id: 'ID',
      number: 'NUMBER',
      title: 'Fix bug',
      description: null,
      status: 'todo',
      statusReason: null,
      startDate: null,
      dueDate: null,
      estimatedMinutes: null,
      remindAt: null,
      parentId: null,
      projectId: project.id,
      recurrenceRuleId: null,
      templateId: null,
      occurrenceDate: null,
      context: 'personal',
      commitment: 'inbox',
      createdAt: 'DATE',
      updatedAt: 'DATE',
    })
  })

  it('does not create a duplicate task for an already-linked issue', async () => {
    const project = await createProject('Inbox')
    await createRule(project.id)
    await upsertGithubToken('valid-token')

    const existingTask = firstOrThrow(
      await db.insert(tasks).values({ title: 'Already tracked' }).returning(),
    )
    await db.insert(taskGithubLinks).values({
      taskId: existingTask.id,
      owner: 'fohte',
      repo: 'tq',
      number: 42,
      role: 'subject',
      notifyEvents: ['closed', 'reopened', 'comments', 'other'],
      kind: 'issue',
      url: 'https://github.com/fohte/tq/issues/42',
      state: 'open',
      title: 'Already tracked',
    })

    mockAssignedIssuesResponse([{ owner: 'fohte', repo: 'tq', number: 42 }])
    await syncGithubAssignedIssues()

    const allTasks = await db.select().from(tasks)
    expect(allTasks).toHaveLength(1)
  })

  it('creates a subject link when the assigned issue is already linked as a blocker', async () => {
    const project = await createProject('Inbox')
    await createRule(project.id)
    await upsertGithubToken('valid-token')
    const blockerTask = firstOrThrow(
      await db
        .insert(tasks)
        .values({ title: 'Waiting for another issue' })
        .returning(),
    )
    await db.insert(taskGithubLinks).values({
      taskId: blockerTask.id,
      owner: 'example-owner',
      repo: 'example-repo',
      number: 17,
      role: 'blocker',
      notifyEvents: defaultGithubNotifyEvents('blocker'),
      kind: 'issue',
      url: 'https://github.com/example-owner/example-repo/issues/17',
      state: 'open',
      title: 'Sample blocker',
    })
    mockAssignedIssuesResponse([
      {
        owner: 'example-owner',
        repo: 'example-repo',
        number: 17,
        comments: 5,
        updatedAt: '2024-08-17T14:50:00Z',
        stateReason: 'future_reason',
      },
    ])

    await syncGithubAssignedIssues()

    const allLinks = await db
      .select()
      .from(taskGithubLinks)
      .where(
        and(
          eq(taskGithubLinks.owner, 'example-owner'),
          eq(taskGithubLinks.repo, 'example-repo'),
          eq(taskGithubLinks.number, 17),
        ),
      )
    const normalizedLinks = allLinks
      .map((link) =>
        normalizeLink({
          ...link,
          taskId:
            link.taskId === blockerTask.id ? 'blocker-task' : 'subject-task',
        }),
      )
      .sort((left, right) => left.role.localeCompare(right.role))

    expect(normalizedLinks).toEqual([
      {
        id: 'ID',
        seq: 'SEQ',
        taskId: 'blocker-task',
        owner: 'example-owner',
        repo: 'example-repo',
        number: 17,
        role: 'blocker',
        notifyEvents: ['closed'],
        kind: 'issue',
        url: 'https://github.com/example-owner/example-repo/issues/17',
        state: 'open',
        title: 'Sample blocker',
        commentsCount: null,
        githubUpdatedAt: null,
        stateReason: null,
        etag: null,
        lastSyncedAt: 'DATE',
        createdAt: 'DATE',
        updatedAt: 'DATE',
      },
      {
        id: 'ID',
        seq: 'SEQ',
        taskId: 'subject-task',
        owner: 'example-owner',
        repo: 'example-repo',
        number: 17,
        role: 'subject',
        notifyEvents: ['closed', 'reopened', 'comments', 'other'],
        kind: 'issue',
        url: 'https://github.com/example-owner/example-repo/issues/17',
        state: 'open',
        title: 'Assigned issue',
        commentsCount: 5,
        githubUpdatedAt: new Date('2024-08-17T14:50:00Z'),
        stateReason: null,
        etag: null,
        lastSyncedAt: 'DATE',
        createdAt: 'DATE',
        updatedAt: 'DATE',
      },
    ])
  })

  it('does nothing for a disabled rule', async () => {
    const project = await createProject('Inbox')
    await createRule(project.id, { enabled: false })
    await upsertGithubToken('valid-token')
    mockAssignedIssuesResponse([{ owner: 'fohte', repo: 'tq', number: 42 }])

    await syncGithubAssignedIssues()

    expect(await findLink('fohte', 'tq', 42)).toBeUndefined()
  })

  it('does nothing, without even calling fetch, when there are no rules', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    await syncGithubAssignedIssues()

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(await db.select().from(tasks)).toEqual([])
  })

  it('only takes matches within an org-scoped rule', async () => {
    const project = await createProject('Inbox')
    await createRule(project.id, { scope: 'org', org: 'fohte', repo: null })
    await upsertGithubToken('valid-token')
    mockAssignedIssuesResponse([
      { owner: 'fohte', repo: 'tq', number: 1 },
      { owner: 'other', repo: 'other-repo', number: 2 },
    ])

    await syncGithubAssignedIssues()

    expect(await findLink('fohte', 'tq', 1)).not.toBeUndefined()
    expect(await findLink('other', 'other-repo', 2)).toBeUndefined()
  })

  it('only takes matches within a repo-scoped rule', async () => {
    const project = await createProject('Inbox')
    await createRule(project.id, { scope: 'repo', org: 'fohte', repo: 'tq' })
    await upsertGithubToken('valid-token')
    mockAssignedIssuesResponse([
      { owner: 'fohte', repo: 'tq', number: 1 },
      { owner: 'fohte', repo: 'other-repo', number: 2 },
    ])

    await syncGithubAssignedIssues()

    expect(await findLink('fohte', 'tq', 1)).not.toBeUndefined()
    expect(await findLink('fohte', 'other-repo', 2)).toBeUndefined()
  })

  describe('includeExisting', () => {
    it('seeds already-matched issues as ignored on the first sync instead of creating tasks for them', async () => {
      const project = await createProject('Inbox')
      const rule = await createRule(project.id, { seedIgnoreOnNextSync: true })
      await upsertGithubToken('valid-token')
      mockAssignedIssuesResponse([{ owner: 'fohte', repo: 'tq', number: 42 }])

      await syncGithubAssignedIssues()

      expect(await findLink('fohte', 'tq', 42)).toBeUndefined()
      const refreshedRule = await db.query.githubSyncRules.findFirst({
        where: eq(githubSyncRules.id, rule.id),
      })
      expect(refreshedRule?.seedIgnoreOnNextSync).toBe(false)
      const ignored = await db
        .select()
        .from(githubSyncRuleIgnoredIssues)
        .where(eq(githubSyncRuleIgnoredIssues.ruleId, rule.id))
      expect(ignored).toHaveLength(1)
    })

    it('keeps ignoring a seeded issue on a later sync even though it is still assigned', async () => {
      const project = await createProject('Inbox')
      await createRule(project.id, { seedIgnoreOnNextSync: true })
      await upsertGithubToken('valid-token')
      mockAssignedIssuesResponse([{ owner: 'fohte', repo: 'tq', number: 42 }])
      await syncGithubAssignedIssues()

      // Still assigned on a later sync — still ignored, since it isn't a new
      // assignment.
      mockAssignedIssuesResponse([{ owner: 'fohte', repo: 'tq', number: 42 }])
      await syncGithubAssignedIssues()

      expect(await findLink('fohte', 'tq', 42)).toBeUndefined()
    })

    it('takes matches immediately when the rule opts in via includeExisting', async () => {
      const project = await createProject('Inbox')
      await createRule(project.id, { seedIgnoreOnNextSync: false })
      await upsertGithubToken('valid-token')
      mockAssignedIssuesResponse([{ owner: 'fohte', repo: 'tq', number: 42 }])

      await syncGithubAssignedIssues()

      expect(await findLink('fohte', 'tq', 42)).not.toBeUndefined()
    })
  })
})
