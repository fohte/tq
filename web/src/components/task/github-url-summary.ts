import type { GithubRef } from '#components/task/github-ref-summary'
import type { ResolveGithubUrlResult } from '#hooks/use-github-link'

export interface GithubUrlSummary extends GithubRef {
  htmlUrl: string
  body: string | null
  linkedTaskId: string | null
}

// Normalizes the two resolve outcomes (an already-linked TQ task vs. a bare
// GitHub preview) into one shape the chip/card can render uniformly. Returns
// `null` for the `linked: true` case's theoretically-impossible but
// type-wise nullable missing `githubLink` (the task was found via that same
// link, so it always has one).
export function toGithubUrlSummary(
  result: ResolveGithubUrlResult,
): GithubUrlSummary | null {
  if (result.linked) {
    const link = result.task.githubLink
    if (link == null) return null
    return {
      kind: link.kind,
      state: link.state,
      owner: link.owner,
      repo: link.repo,
      number: link.number,
      title: link.title,
      htmlUrl: link.url,
      body: null,
      linkedTaskId: result.task.id,
    }
  }

  const { preview } = result
  return {
    kind: preview.kind,
    state: preview.state,
    owner: preview.owner,
    repo: preview.repo,
    number: preview.number,
    title: preview.title,
    htmlUrl: preview.url,
    body: preview.body,
    linkedTaskId: null,
  }
}
