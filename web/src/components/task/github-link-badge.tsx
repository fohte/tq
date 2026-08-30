import { CircleDot, GitPullRequest } from 'lucide-react'

import { Chip } from '#components/ui/chip'
import type { GithubLink } from '#hooks/use-github-link'
import { cn } from '#lib/utils'

const STATE_COLORS: Record<GithubLink['state'], string> = {
  open: 'text-github-open',
  closed: 'text-github-closed',
  merged: 'text-github-merged',
}

// Rendered as a <button>, never an <a>: call sites (e.g. task rows) nest
// this inside their own navigation <Link>, and a nested <a> would be
// invalid HTML and hijack the outer navigation's click.
export function GithubLinkBadge({
  link,
  extraCount,
}: {
  link: GithubLink
  // Set when this badge represents more than one linked issue/PR, to append
  // a "+N" for the rest — see GithubLinksChipGroup.
  extraCount?: number
}) {
  return (
    <Chip
      as="button"
      className={cn('shrink-0', STATE_COLORS[link.state])}
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
    </Chip>
  )
}
