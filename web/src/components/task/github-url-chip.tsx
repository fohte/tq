import { Link } from '@tanstack/react-router'

import type { GithubRef } from '#components/task/github-ref-summary'
import { GithubRefSummary } from '#components/task/github-ref-summary'
import {
  PreviewCard,
  PreviewCardPopup,
  PreviewCardPortal,
  PreviewCardPositioner,
  PreviewCardTrigger,
} from '#components/ui/preview-card'
import type { ResolveGithubUrlResult } from '#hooks/use-github-link'
import { useGithubUrlPreview } from '#hooks/use-github-url-preview'
import type { GithubUrlData } from '#lib/inline-reference/providers/github-url'

interface GithubUrlSummary extends GithubRef {
  htmlUrl: string
  body: string | null
  linkedTaskId: string | null
}

// Normalizes the two resolve outcomes (an already-linked TQ task vs. a bare
// GitHub preview) into one shape the chip can render uniformly. Returns
// `null` for the `linked: true` case's theoretically-impossible but
// type-wise nullable missing `githubLink` (the task was found via that same
// link, so it always has one).
function toGithubUrlSummary(
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

export function GithubUrlChip({
  data,
  raw,
}: {
  data: GithubUrlData
  raw: string
}) {
  const { data: result } = useGithubUrlPreview(data.url)
  if (result == null) return <span>{raw}</span>

  const summary = toGithubUrlSummary(result)
  if (summary == null) return <span>{raw}</span>

  return (
    <PreviewCard>
      <PreviewCardTrigger
        render={<span />}
        className="inline-flex cursor-text items-center gap-1 rounded border border-border bg-secondary/50 px-1.5 py-0.5 align-baseline text-sm leading-none"
      >
        <GithubRefSummary {...summary} titleClassName="max-w-48" />
      </PreviewCardTrigger>
      <PreviewCardPortal>
        <PreviewCardPositioner>
          <PreviewCardPopup>
            <a
              href={summary.htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col gap-1.5"
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                <GithubRefSummary {...summary} />
              </div>
              {summary.body != null && summary.body !== '' && (
                <p className="line-clamp-3 text-xs text-muted-foreground">
                  {summary.body}
                </p>
              )}
            </a>
            {summary.linkedTaskId != null && (
              <Link
                to="/tasks/$taskId"
                params={{ taskId: summary.linkedTaskId }}
                className="mt-1.5 block text-xs text-muted-foreground hover:underline"
              >
                Linked to a TQ task →
              </Link>
            )}
          </PreviewCardPopup>
        </PreviewCardPositioner>
      </PreviewCardPortal>
    </PreviewCard>
  )
}
