import { captureWithFingerprint } from '@fohte/service-kit/observability'
import { eq } from 'drizzle-orm'

import { db } from '#db/connection'
import {
  githubSyncRuleIgnoredIssues,
  githubSyncRules,
  taskGithubLinks,
} from '#db/schema'
import {
  fetchAssignedIssues,
  type GithubIssueData,
} from '#integrations/github/issues'
import { isQuietProviderError } from '#integrations/quiet-errors'
import {
  createTaskFromIssueData,
  GithubResourceAlreadyLinkedError,
  TaskAlreadyLinkedError,
} from '#services/task-github-links'

type SyncRuleRow = typeof githubSyncRules.$inferSelect

function issueKey(owner: string, repo: string, number: number): string {
  return `${owner.toLowerCase()}/${repo.toLowerCase()}/${String(number)}`
}

function ruleMatches(rule: SyncRuleRow, owner: string, repo: string): boolean {
  const lowerOwner = owner.toLowerCase()
  const lowerRepo = repo.toLowerCase()
  switch (rule.scope) {
    case 'all':
      return true
    case 'org':
      return rule.org?.toLowerCase() === lowerOwner
    case 'repo':
      return (
        rule.org?.toLowerCase() === lowerOwner &&
        rule.repo?.toLowerCase() === lowerRepo
      )
    default:
      return false
  }
}

// Extends isQuietProviderError with this module's own quiet case: a
// duplicate-link error just means someone else (a concurrent manual link,
// or another matching rule in this same pass) already created the task this
// rule wanted to create — the desired end-state either way, not a failure.
function isQuietRuleSyncError(error: Error): boolean {
  if (isQuietProviderError(error)) return true
  if (error instanceof TaskAlreadyLinkedError) return true
  if (error instanceof GithubResourceAlreadyLinkedError) return true
  return false
}

// On a rule's first sync pass after creation with includeExisting left off,
// whatever currently matches it is a baseline to ignore going forward, not
// new assignments to turn into tasks — otherwise "don't take existing ones"
// would only hold until this very first pass.
async function seedIgnoredIssues(
  rule: SyncRuleRow,
  matches: GithubIssueData[],
): Promise<void> {
  if (matches.length > 0) {
    await db
      .insert(githubSyncRuleIgnoredIssues)
      .values(
        matches.map((issue) => ({
          ruleId: rule.id,
          owner: issue.owner,
          repo: issue.repo,
          number: issue.number,
        })),
      )
      .onConflictDoNothing()
  }
  await db
    .update(githubSyncRules)
    .set({ seedIgnoreOnNextSync: false, updatedAt: new Date() })
    .where(eq(githubSyncRules.id, rule.id))
}

// Runs alongside syncAllGithubLinks (see github-sync.ts) so new-assignment
// detection piggybacks on the same client-driven activity signal instead of
// a dedicated poll: `GET /issues` only ever returns currently-assigned
// issues, so anything in it that isn't linked or ignored yet is a fresh
// assignment.
export async function syncGithubAssignedIssues(): Promise<void> {
  const rules = await db
    .select()
    .from(githubSyncRules)
    .where(eq(githubSyncRules.enabled, true))
  if (rules.length === 0) return

  const assignedResult = await fetchAssignedIssues()
  if (assignedResult.isErr()) {
    if (!isQuietRuleSyncError(assignedResult.error)) {
      captureWithFingerprint(
        assignedResult.error,
        'api.github-sync-rules.fetch-assigned-failed',
      )
    }
    return
  }
  const assignedIssues = assignedResult.value

  const linkedRows = await db
    .select({
      owner: taskGithubLinks.owner,
      repo: taskGithubLinks.repo,
      number: taskGithubLinks.number,
    })
    .from(taskGithubLinks)
  const linkedKeys = new Set(
    linkedRows.map((r) => issueKey(r.owner, r.repo, r.number)),
  )

  for (const rule of rules) {
    const matches = assignedIssues.filter((issue) =>
      ruleMatches(rule, issue.owner, issue.repo),
    )

    if (rule.seedIgnoreOnNextSync) {
      await seedIgnoredIssues(rule, matches)
      continue
    }

    const ignoredRows = await db
      .select({
        owner: githubSyncRuleIgnoredIssues.owner,
        repo: githubSyncRuleIgnoredIssues.repo,
        number: githubSyncRuleIgnoredIssues.number,
      })
      .from(githubSyncRuleIgnoredIssues)
      .where(eq(githubSyncRuleIgnoredIssues.ruleId, rule.id))
    const ignoredKeys = new Set(
      ignoredRows.map((r) => issueKey(r.owner, r.repo, r.number)),
    )

    for (const issue of matches) {
      const key = issueKey(issue.owner, issue.repo, issue.number)
      if (linkedKeys.has(key) || ignoredKeys.has(key)) continue

      const result = await createTaskFromIssueData(issue, {
        projectId: rule.targetProjectId,
      })
      if (result.isErr()) {
        if (!isQuietRuleSyncError(result.error)) {
          captureWithFingerprint(
            result.error,
            'api.github-sync-rules.create-task-failed',
            {
              extras: {
                ruleId: rule.id,
                owner: issue.owner,
                repo: issue.repo,
                number: issue.number,
              },
            },
          )
        }
        continue
      }
      linkedKeys.add(key)
    }
  }
}
