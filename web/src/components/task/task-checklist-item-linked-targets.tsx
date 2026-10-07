import { Link } from '@tanstack/react-router'

import { GithubLinkBadge } from '#components/task/github-link-badge'
import type { GithubLink } from '#hooks/use-github-link'
import type { Task } from '#hooks/use-tasks'

export function TaskChecklistItemLinkedTargets({
  githubLink,
  subtask,
}: {
  githubLink: GithubLink | undefined
  subtask: Task | undefined
}) {
  return (
    (githubLink != null || subtask != null) && (
      <div className="mt-1 flex min-w-0 flex-wrap gap-1">
        {githubLink != null && <GithubLinkBadge link={githubLink} />}
        {subtask != null && (
          <Link
            to="/tasks/$taskId"
            params={{ taskId: subtask.id }}
            aria-label={`#${String(subtask.number)} ${subtask.title}`}
            className="inline-flex max-w-full min-w-0 items-center gap-1 border border-border px-1 font-mono text-2xs text-muted-foreground hover:text-foreground"
          >
            <span className="shrink-0 font-bold text-primary">
              #{subtask.number}
            </span>
            <span className="truncate">{subtask.title}</span>
          </Link>
        )}
      </div>
    )
  )
}
