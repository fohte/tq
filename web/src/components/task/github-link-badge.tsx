import { CircleDot, GitPullRequest } from 'lucide-react'

import { Chip } from '#components/ui/chip'
import type { GithubLink } from '#hooks/use-github-link'
import { cn } from '#lib/utils'

// Rendered as a <button>, never an <a>: call sites (e.g. task rows) nest
// this inside their own navigation <Link>, and a nested <a> would be
// invalid HTML and hijack the outer navigation's click.
export function GithubLinkBadge({ link }: { link: GithubLink }) {
  return (
    <Chip
      as="button"
      className={cn(
        'shrink-0',
        link.state === 'open' && 'text-muted-foreground-strong',
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
    </Chip>
  )
}
