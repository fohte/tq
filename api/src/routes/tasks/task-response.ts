import { recurrenceRules, taskGithubLinks, tasks, timeBlocks } from '#db/schema'

export function recurrenceRuleToResponse(
  rule: typeof recurrenceRules.$inferSelect,
) {
  return {
    id: rule.id,
    type: rule.type,
    interval: rule.interval,
    daysOfWeek: rule.daysOfWeek,
    dayOfMonth: rule.dayOfMonth,
  }
}

export function githubLinkToResponse(
  link: typeof taskGithubLinks.$inferSelect,
) {
  return {
    id: link.id,
    owner: link.owner,
    repo: link.repo,
    number: link.number,
    kind: link.kind,
    role: link.role,
    notifyEvents: link.notifyEvents,
    url: link.url,
    state: link.state,
    title: link.title,
    lastSyncedAt: link.lastSyncedAt.toISOString(),
  }
}

function taskCoreFieldsToResponse(
  task: Omit<typeof tasks.$inferSelect, 'description'>,
  rule: typeof recurrenceRules.$inferSelect | null = null,
  githubLinks: (typeof taskGithubLinks.$inferSelect)[] = [],
  labelNames: string[] = [],
) {
  return {
    id: task.id,
    number: task.number,
    title: task.title,
    status: task.status,
    statusReason: task.statusReason,
    context: task.context,
    commitment: task.commitment,
    labels: labelNames,
    startDate: task.startDate,
    dueDate: task.dueDate,
    remindAt: task.remindAt?.toISOString() ?? null,
    parentId: task.parentId,
    projectId: task.projectId,
    recurrenceRuleId: task.recurrenceRuleId,
    recurrenceRule: rule ? recurrenceRuleToResponse(rule) : null,
    templateId: task.templateId,
    occurrenceDate: task.occurrenceDate,
    githubLinks: githubLinks.map(githubLinkToResponse),
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  }
}

function taskCoreToResponse(
  task: typeof tasks.$inferSelect,
  rule: typeof recurrenceRules.$inferSelect | null = null,
  githubLinks: (typeof taskGithubLinks.$inferSelect)[] = [],
  labelNames: string[] = [],
) {
  return {
    ...taskCoreFieldsToResponse(task, rule, githubLinks, labelNames),
    description: task.description,
  }
}

export function taskToResponse(
  task: typeof tasks.$inferSelect,
  rule?: typeof recurrenceRules.$inferSelect | null,
  githubLinks: (typeof taskGithubLinks.$inferSelect)[] = [],
  labelNames: string[] = [],
) {
  return taskCoreToResponse(task, rule ?? null, githubLinks, labelNames)
}

export function timeBlockToResponse(block: typeof timeBlocks.$inferSelect) {
  return {
    id: block.id,
    taskId: block.taskId,
    startTime: block.startTime.toISOString(),
    endTime: block.endTime.toISOString(),
    isAutoScheduled: block.isAutoScheduled,
    createdAt: block.createdAt.toISOString(),
    updatedAt: block.updatedAt.toISOString(),
  }
}

export { taskCoreFieldsToResponse }
