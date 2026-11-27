import { Button } from '@fohte/ui/button'

export function ProjectFieldsLoadError({
  mobile = false,
  onRetry,
}: {
  mobile?: boolean
  onRetry: () => void
}) {
  return (
    <div
      role="alert"
      className={
        mobile
          ? 'col-span-2 flex items-center justify-between gap-2 border-b border-border p-2.5 text-xs last:border-b-0'
          : 'flex items-center justify-between gap-2 text-xs'
      }
    >
      <span className="text-destructive">Could not load project fields.</span>
      <Button
        type="button"
        variant="plain"
        size="sm"
        onClick={() => {
          onRetry()
        }}
      >
        Retry
      </Button>
    </div>
  )
}
