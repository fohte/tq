import { Button } from '@fohte/ui/button'

import type {
  ScheduleEditAction,
  ScheduleEditScope,
} from '#components/schedule/schedule-edit-dialog-state'

export function ScheduleRangeActionButtons({
  scope,
  action,
  canRestore,
  setAction,
}: {
  scope: ScheduleEditScope
  action: ScheduleEditAction
  canRestore: boolean
  setAction: (action: ScheduleEditAction) => void
}) {
  if (scope === 'this') {
    return (
      <>
        <Button
          type="button"
          variant={action === 'skip' ? 'destructive' : 'outline'}
          aria-pressed={action === 'skip'}
          onClick={() => {
            setAction(action === 'skip' ? null : 'skip')
          }}
        >
          Skip this event
        </Button>
        {canRestore && (
          <Button
            type="button"
            variant={action === 'restore' ? 'secondary' : 'outline'}
            aria-pressed={action === 'restore'}
            onClick={() => {
              setAction(action === 'restore' ? null : 'restore')
            }}
          >
            Restore
          </Button>
        )}
      </>
    )
  }

  if (scope === 'following') {
    return (
      <Button
        type="button"
        variant={action === 'endSeries' ? 'destructive' : 'outline'}
        aria-pressed={action === 'endSeries'}
        onClick={() => {
          setAction(action === 'endSeries' ? null : 'endSeries')
        }}
      >
        End series here
      </Button>
    )
  }

  return null
}
