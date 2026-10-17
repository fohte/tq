type WaitAcknowledgementState = {
  resolvedAt: string | null
  acknowledgedAt: string | null
}

export function needsWaitAcknowledgement(wait: WaitAcknowledgementState) {
  return wait.resolvedAt != null && wait.acknowledgedAt == null
}

export function isTaskWaitBlocking(wait: WaitAcknowledgementState) {
  return wait.resolvedAt == null || needsWaitAcknowledgement(wait)
}
