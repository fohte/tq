import { preventClickWhileSelecting } from '#components/task/prevent-click-while-selecting'
import { Badge } from '#components/ui/badge'
import { useSlackPermalinkPreview } from '#hooks/use-slack-permalink-preview'
import type { SlackPermalinkData } from '#lib/inline-reference/providers/slack-permalink'

export function SlackPermalinkCard({
  data,
  raw,
}: {
  data: SlackPermalinkData
  raw: string
}) {
  const { data: preview } = useSlackPermalinkPreview(data.url)
  if (preview == null) return <span>{raw}</span>

  return (
    <div className="block border border-border bg-card p-3">
      <a
        href={data.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={preventClickWhileSelecting}
        onMouseUp={(event) => {
          event.stopPropagation()
        }}
        className="flex flex-col gap-1.5"
      >
        <div className="flex items-center gap-2">
          {preview.authorAvatarUrl != null ? (
            <img
              src={preview.authorAvatarUrl}
              alt=""
              className="size-5 shrink-0 border border-border"
            />
          ) : (
            <div className="size-5 shrink-0 border border-border bg-secondary" />
          )}
          <span className="font-sans text-sm font-medium">
            {preview.authorName}
          </span>
          <span className="text-sm text-muted-foreground">
            #{preview.channelName}
          </span>
          {preview.isThreadReply && (
            <Badge variant="outline">thread reply</Badge>
          )}
        </div>
        {preview.text !== '' && (
          <p className="line-clamp-3 font-sans text-sm text-muted-foreground">
            {preview.text}
          </p>
        )}
      </a>
    </div>
  )
}
