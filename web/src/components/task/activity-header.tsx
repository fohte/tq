import type { Comment } from '#hooks/use-task-comments'
import { cn } from '#lib/utils'

type ActivityAuthor = Comment['author']

// tq is a single-user tool, so authors carry a role (human/llm/system) rather
// than a name. Missing data (e.g. comments created before authors were
// tracked) falls back to a neutral placeholder instead of a blank.
export function formatWho(author: ActivityAuthor | null): string {
  if (!author) return 'someone'
  if (author.kind === 'human') return 'you'
  if (author.kind === 'system') return 'system'
  return author.agent ?? 'someone'
}

export function ActivityHeader({
  who,
  what,
  when,
  className,
}: {
  who: string
  what: string
  when: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-baseline gap-2 font-mono text-2xs text-muted-foreground',
        className,
      )}
    >
      <span className="text-muted-foreground-strong">{who}</span>
      <span>{what}</span>
      <span className="ml-auto text-muted-foreground-ghost">{when}</span>
    </div>
  )
}
