import { CircleDot, GitPullRequest } from 'lucide-react'

import type { GithubLink } from '#hooks/use-github-link'
import { cn } from '#lib/utils'

const STATE_COLORS: Record<GithubLink['state'], string> = {
  open: 'text-github-open',
  closed: 'text-github-closed',
  merged: 'text-github-merged',
}

export interface GithubRef {
  kind: GithubLink['kind']
  state: GithubLink['state']
  owner: string
  repo: string
  number: number
  title: string
}

export function GithubRefSummary({
  kind,
  state,
  owner,
  repo,
  number,
  title,
  titleClassName,
}: GithubRef & { titleClassName?: string }) {
  const Icon = kind === 'pull_request' ? GitPullRequest : CircleDot

  return (
    <>
      <Icon className={cn('size-3.5 shrink-0', STATE_COLORS[state])} />
      <span className="shrink-0 text-muted-foreground">
        {owner}/{repo}#{number}
      </span>
      <span className={cn('truncate', titleClassName)}>{title}</span>
    </>
  )
}
