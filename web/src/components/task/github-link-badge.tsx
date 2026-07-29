import { CircleDot, GitPullRequest } from 'lucide-react'

import type { GithubLink } from '#hooks/use-github-link'
import { cn } from '#lib/utils'

const STATE_STYLES: Record<GithubLink['state'], string> = {
  open: 'bg-[#17301F] text-[#3FB950]',
  closed: 'bg-[#3D2020] text-[#F85149]',
  merged: 'bg-[#2B2140] text-[#A371F7]',
}

// Rendered as a <button>, never an <a>: call sites (e.g. task rows) nest
// this inside their own navigation <Link>, and a nested <a> would be
// invalid HTML and hijack the outer navigation's click.
export function GithubLinkBadge({ link }: { link: GithubLink }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        window.open(link.url, '_blank', 'noopener,noreferrer')
      }}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-[10px] px-2 py-0.5 text-[11px] font-medium',
        STATE_STYLES[link.state],
      )}
    >
      {link.kind === 'pull_request' ? (
        <GitPullRequest className="size-3" />
      ) : (
        <CircleDot className="size-3" />
      )}
      {link.repo}#{link.number}
    </button>
  )
}
