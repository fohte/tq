export function SlackAuthorSummary({
  authorName,
  authorAvatarUrl,
  channelName,
}: {
  authorName: string
  authorAvatarUrl: string | null
  channelName: string
}) {
  return (
    <>
      {authorAvatarUrl != null ? (
        <img
          src={authorAvatarUrl}
          alt=""
          className="size-5 shrink-0 border border-border"
        />
      ) : (
        <div className="size-5 shrink-0 border border-border bg-secondary" />
      )}
      <span className="font-sans text-sm font-medium">{authorName}</span>
      <span className="text-sm text-muted-foreground">#{channelName}</span>
    </>
  )
}
