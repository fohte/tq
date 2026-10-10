interface CandidateCheckable {
  id: string
  candidateReason?: CandidateReason | null | undefined
}

export type CandidateReason =
  | { kind: 'overdue'; days: number }
  | { kind: 'follow-up'; days: number }
  | { kind: 'due-today' }
  | { kind: 'due-later'; days: number }
  | { kind: 'starts'; days: number }
  | { kind: 'active' }

export interface QueueCandidate<T> {
  task: T
  reason: CandidateReason
}

/** Pairs the candidate reasons and ordering returned by `candidatesOn` with their tasks. */
export function getQueueCandidates<T extends CandidateCheckable>(
  tasks: T[],
): QueueCandidate<T>[] {
  return tasks.flatMap<QueueCandidate<T>>((task) =>
    task.candidateReason == null
      ? []
      : [{ task, reason: task.candidateReason }],
  )
}

export function formatCandidateReason(reason: CandidateReason): string {
  switch (reason.kind) {
    case 'overdue':
      return `${String(reason.days)}d overdue`
    case 'follow-up':
      return reason.days === 0
        ? 'follow up today'
        : `follow up ${String(reason.days)}d ago`
    case 'due-today':
      return 'due today'
    case 'due-later':
      return `due in ${String(reason.days)}d`
    case 'starts':
      return reason.days === 0
        ? 'starts today'
        : `started ${String(reason.days)}d ago`
    case 'active':
      return 'active'
  }
}

/** dnd-kit drag data carried by a candidate card, shared by every place a candidate is draggable onto a queue. */
export interface CandidateDragData extends Record<string, unknown> {
  type: 'candidate'
  taskId: string
}

export function isCandidateDragData(
  data: Record<string, unknown> | undefined,
): data is CandidateDragData {
  return data?.['type'] === 'candidate'
}
