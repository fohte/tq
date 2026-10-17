export function SchedulePreviewNotice({
  text,
  isLoading,
  isError,
}: {
  text: string | null
  isLoading: boolean
  isError: boolean
}) {
  if (text == null && !isLoading && !isError) return null

  return (
    <p
      aria-live="polite"
      className="rounded-md border-l-2 border-primary bg-surface-strong px-3 py-2 text-xs text-foreground"
    >
      {isLoading
        ? 'Updating preview…'
        : isError
          ? 'Could not load the preview. Try again after editing.'
          : text}
    </p>
  )
}
