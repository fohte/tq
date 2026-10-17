import { Button } from '@fohte/ui/button'

import type { ScheduleOverride } from '#hooks/use-schedules'

export function ScheduleExceptionList({
  exceptions,
  isLoading,
  isError,
  onRestore,
  isRestorePending,
}: {
  exceptions: ScheduleOverride[]
  isLoading: boolean
  isError: boolean
  onRestore: (occurrenceDate: string) => void
  isRestorePending: boolean
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-2xs tracking-widest text-muted-foreground-faint">
        EXCEPTIONS
      </span>
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading exceptions…</p>
      ) : isError ? (
        <p className="text-xs text-destructive">Could not load exceptions.</p>
      ) : exceptions.length === 0 ? (
        <p className="text-xs text-muted-foreground">No exceptions</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {exceptions.map((exception) => (
            <li
              key={exception.occurrenceDate}
              className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-xs"
            >
              <span>
                {exception.skipped
                  ? `${exception.occurrenceDate} · skipped`
                  : exception.movedToDate != null
                    ? `${exception.occurrenceDate} → ${exception.movedToDate}`
                    : `${exception.occurrenceDate} · time changed`}
              </span>
              <Button
                type="button"
                variant="outline"
                size="xs"
                disabled={isRestorePending}
                onClick={() => {
                  onRestore(exception.occurrenceDate)
                }}
              >
                Restore
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
