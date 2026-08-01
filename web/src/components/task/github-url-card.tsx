import { Link } from '@tanstack/react-router'

import { GithubRefSummary } from '#components/task/github-ref-summary'
import { toGithubUrlSummary } from '#components/task/github-url-summary'
import { preventClickWhileSelecting } from '#components/task/prevent-click-while-selecting'
import { Badge } from '#components/ui/badge'
import { useGithubUrlPreview } from '#hooks/use-github-url-preview'
import type { GithubUrlData } from '#lib/inline-reference/providers/github-url'

export function GithubUrlCard({
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
    <div className="block border border-border bg-card p-3">
      <a
        href={summary.htmlUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={preventClickWhileSelecting}
        onMouseUp={(event) => {
          event.stopPropagation()
        }}
        className="flex flex-col gap-1.5"
      >
        <div className="flex items-center gap-2">
          {/* Title is rendered as its own line below at a larger size;
              GithubRefSummary always renders a title span, so pass an empty
              one here to surface just its icon + owner/repo#number part. */}
          <GithubRefSummary {...summary} title="" />
          <Badge variant="outline">{summary.state}</Badge>
        </div>
        <p className="line-clamp-2 font-sans text-sm font-medium">
          {summary.title}
        </p>
        {summary.body != null && summary.body !== '' && (
          <p className="line-clamp-3 font-sans text-xs text-muted-foreground">
            {summary.body}
          </p>
        )}
      </a>
      {summary.linkedTaskId != null && (
        <Link
          to="/tasks/$taskId"
          params={{ taskId: summary.linkedTaskId }}
          onClick={preventClickWhileSelecting}
          onMouseUp={(event) => {
            event.stopPropagation()
          }}
          className="mt-1.5 block text-xs text-muted-foreground hover:underline"
        >
          Linked to a TQ task →
        </Link>
      )}
    </div>
  )
}
