import type { TaskLinkSyncResult } from '#services/task-links'

export function toTaskLinkSyncResponse(result: TaskLinkSyncResult) {
  return {
    added: result.added,
    unresolvedRefs: result.unresolvedRefs,
  }
}
