import { SessionRow } from '#components/agent-session/session-row'
import { Panel } from '#components/ui/panel'
import { SectionHeading } from '#components/ui/section-heading'
import { SectionLoadingIndicator } from '#components/ui/section-loading-indicator'
import type { AgentSession } from '#hooks/use-agent-sessions'
import { useTaskAgentSessions } from '#hooks/use-task-agent-sessions'

// --- Sessions Section (in task detail, self-fetching) ---

export function TaskSessionsSection({ taskId }: { taskId: string }) {
  const { data: sessions, isLoading, isError } = useTaskAgentSessions(taskId)

  if (isLoading) {
    return <SectionLoadingIndicator label="sessions" />
  }

  if (isError) {
    return (
      <p className="font-mono text-xs text-destructive">
        Failed to load sessions.
      </p>
    )
  }

  return <TaskSessionsList sessions={sessions ?? []} />
}

// --- Sessions List (pure presentation, for Storybook) ---

export function TaskSessionsList({ sessions }: { sessions: AgentSession[] }) {
  return (
    <div className="flex flex-col gap-2.5">
      <SectionHeading level={3}>sessions</SectionHeading>

      {sessions.length === 0 ? (
        <p className="font-mono text-xs text-muted-foreground">
          No sessions linked to this task yet.
        </p>
      ) : (
        <Panel>
          {sessions.map((session) => (
            <SessionRow key={session.id} session={session} isDimmed={false} />
          ))}
        </Panel>
      )}
    </div>
  )
}
