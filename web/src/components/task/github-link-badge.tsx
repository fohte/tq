import { CircleDot, GitPullRequest } from 'lucide-react'

import type { GithubLink } from '#hooks/use-github-link'
import { cn } from '#lib/utils'

const STATE_COLORS = {
  open: 'text-github-open',
  closed: 'text-github-closed',
  merged: 'text-github-merged',
} satisfies Record<GithubLink['state'], string>

// Rendered as a <button>, never an <a>: call sites (e.g. task rows) nest
// this inside their own navigation <Link>, and a nested <a> would be
// invalid HTML and hijack the outer navigation's click.
export function GithubLinkBadge({
  link,
  extraCount,
}: {
  link: GithubLink
  extraCount?: number
}) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex shrink-0 cursor-pointer items-center gap-1 border border-border px-1 font-mono text-2xs',
        link.state === 'open' && STATE_COLORS.open,
        link.state === 'closed' && STATE_COLORS.closed,
        link.state === 'merged' && STATE_COLORS.merged,
      )}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        window.open(link.url, '_blank', 'noopener,noreferrer')
      }}
    >
      {link.kind === 'pull_request' ? (
        <GitPullRequest className="size-3" />
      ) : (
        <CircleDot className="size-3" />
      )}
      {link.repo}#{link.number}
      {extraCount != null && extraCount > 0 && (
        <span className="text-muted-foreground-faint">+{extraCount}</span>
      )}
    </button>
  )
}
