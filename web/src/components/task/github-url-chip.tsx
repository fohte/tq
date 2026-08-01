import { Link } from '@tanstack/react-router'

import { GithubRefSummary } from '#components/task/github-ref-summary'
import { toGithubUrlSummary } from '#components/task/github-url-summary'
import {
  PreviewCard,
  PreviewCardPopup,
  PreviewCardPortal,
  PreviewCardPositioner,
  PreviewCardTrigger,
} from '#components/ui/preview-card'
import { useGithubUrlPreview } from '#hooks/use-github-url-preview'
import type { GithubUrlData } from '#lib/inline-reference/providers/github-url'

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
        className="inline-flex cursor-text items-center gap-1 border border-border bg-secondary/50 px-1.5 py-0.5 align-baseline text-sm leading-none"
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
