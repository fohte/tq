import { Button } from '@fohte/ui/button'

export function ProjectFieldsLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-2 px-2.5 py-1 text-xs"
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
