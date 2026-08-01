import {
  PreviewCard,
  PreviewCardPopup,
  PreviewCardPortal,
  PreviewCardPositioner,
  PreviewCardTrigger,
} from '#components/ui/preview-card'
import { useSlackPermalinkPreview } from '#hooks/use-slack-permalink-preview'
import type { SlackPermalinkData } from '#lib/inline-reference/providers/slack-permalink'

export function SlackPermalinkChip({
  data,
  raw,
}: {
  data: SlackPermalinkData
  raw: string
}) {
  const { data: preview } = useSlackPermalinkPreview(data.url)
  if (preview == null) return <span>{raw}</span>

  return (
    <PreviewCard>
      <PreviewCardTrigger
        render={<span />}
        className="inline-flex cursor-text items-center gap-1 border border-border bg-secondary/50 px-1.5 py-0.5 align-baseline text-sm leading-none"
      >
        <span className="shrink-0 text-muted-foreground">
          #{preview.channelName}
        </span>
        <span className="shrink-0 font-medium">{preview.authorName}:</span>
        <span className="max-w-48 truncate">{preview.text}</span>
      </PreviewCardTrigger>
      <PreviewCardPortal>
        <PreviewCardPositioner>
          <PreviewCardPopup>
            <a
              href={data.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col gap-1.5"
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                {preview.authorAvatarUrl != null ? (
                  <img
                    src={preview.authorAvatarUrl}
                    alt=""
                    className="size-5 shrink-0 border border-border"
                  />
                ) : (
                  <div className="size-5 shrink-0 border border-border bg-secondary" />
                )}
                <span>{preview.authorName}</span>
                <span className="text-muted-foreground">
                  #{preview.channelName}
                </span>
              </div>
              {preview.text !== '' && (
                <p className="line-clamp-3 text-xs text-muted-foreground">
                  {preview.text}
                </p>
              )}
            </a>
          </PreviewCardPopup>
        </PreviewCardPositioner>
      </PreviewCardPortal>
    </PreviewCard>
  )
}
