import { TaskCompletionBlockerPanelAppearance } from '#components/layout/task-completion-blocker-panel-appearance'
import { useTaskCompletionFailure } from '#hooks/use-task-completion-failure'
import { useCompleteTask, useUpdateTaskStatus } from '#hooks/use-task-mutations'
import { useTask } from '#hooks/use-task-queries'
import { useResolveTaskWait } from '#hooks/use-task-waits'

export function TaskCompletionFailurePanel() {
  const { failure, dismiss } = useTaskCompletionFailure()
  const taskQuery = useTask(failure?.request.id ?? '', {
    enabled: failure !== null,
  })
  const resolveWait = useResolveTaskWait(failure?.request.id ?? '')
  const updateStatus = useUpdateTaskStatus()
  const completeTask = useCompleteTask()

  if (failure === null) return null

  const isFresh = taskQuery.isFetched && taskQuery.data !== undefined
  const initialBlockers = failure.blockers
  const taskBlockers =
    initialBlockers === null
      ? []
      : initialBlockers.blockedByNumbers.map((number) => ({
          number,
          resolved: isFresh
            ? !taskQuery.data.blockedBy.some(
                (blocker) =>
                  blocker.number === number && blocker.status !== 'completed',
              )
            : false,
        }))
  const githubBlockers =
    initialBlockers === null
      ? []
      : initialBlockers.blockedByGithubRefs.map((blocker) => ({
          key: `${blocker.owner}/${blocker.repo}#${String(blocker.number)}`,
          label: `${blocker.owner}/${blocker.repo}#${String(blocker.number)}`,
          url: blocker.url,
          resolved: isFresh
            ? !taskQuery.data.githubBlockers.some(
                (current) =>
                  current.owner === blocker.owner &&
                  current.repo === blocker.repo &&
                  current.number === blocker.number &&
                  current.state === 'open',
              )
            : false,
        }))
  const waits =
    initialBlockers === null
      ? []
      : initialBlockers.blockedByWaits.map((wait) => ({
          id: wait.id,
          label: wait.label,
          resolved: isFresh
            ? !(
                taskQuery.data.waits?.some(
                  (current) =>
                    current.id === wait.id && current.resolvedAt === null,
                ) ?? false
              )
            : false,
        }))

  const complete = () => {
    const { request } = failure
    const metadata = {
      ...(request.taskNumber == null ? {} : { taskNumber: request.taskNumber }),
      ...(request.statusReason == null
        ? {}
        : { statusReason: request.statusReason }),
      ...(request.duplicateOfTaskId == null
        ? {}
        : { duplicateOfTaskId: request.duplicateOfTaskId }),
    }
    const result =
      request.kind === 'status'
        ? updateStatus.mutateAsync({
            id: request.id,
            status: 'completed',
            ...metadata,
          })
        : completeTask.mutateAsync({ id: request.id, ...metadata })
    void result.then(
      () => {
        dismiss(failure.id)
      },
      () => {},
    )
  }

  return (
    <TaskCompletionBlockerPanelAppearance
      {...(failure.request.taskNumber == null
        ? {}
        : { taskNumber: failure.request.taskNumber })}
      waits={waits}
      taskBlockers={taskBlockers}
      githubBlockers={githubBlockers}
      message={failure.message}
      isRetryPending={updateStatus.isPending || completeTask.isPending}
      resolvingWaitId={resolveWait.isPending ? resolveWait.variables : null}
      onResolveWait={(waitId) => {
        resolveWait.mutate(waitId)
      }}
      onComplete={complete}
      onClose={() => {
        dismiss(failure.id)
      }}
    />
  )
}
