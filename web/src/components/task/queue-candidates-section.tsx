import { QueueCandidateRow } from '#components/task/queue-candidate-row'
import { Chip } from '#components/ui/chip'
import type { Task } from '#hooks/use-tasks'
import type { QueueCandidate } from '#lib/queue-candidates'

export function QueueCandidatesSection({
  candidates,
  onAdd,
}: {
  candidates: QueueCandidate<Task>[]
  onAdd: (taskId: string) => void
}) {
  if (candidates.length === 0) return null

  return (
    <div className="border-t border-border">
      <div className="flex items-center gap-2 px-3 py-2 font-mono text-xs text-muted-foreground">
        <span>candidates</span>
        <Chip>{candidates.length}</Chip>
      </div>

      <div>
        {candidates.map(({ task, reason }) => (
          <QueueCandidateRow
            key={task.id}
            task={task}
            reason={reason}
            onAdd={() => {
              onAdd(task.id)
            }}
          />
        ))}
      </div>
    </div>
  )
}
