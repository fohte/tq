import { Button } from '@fohte/ui/button'
import { useEffect, useMemo, useState } from 'react'

import type { TimeBlockEvent } from '#components/calendar/calendar-view'
import { buildNowPanelModel } from '#components/day-view/now-panel-model'
import { TaskRowAppearance } from '#components/task/task-row-appearance'
import type { Task } from '#hooks/use-tasks'
import type { TimeBlock } from '#hooks/use-time-blocks'
import { hasTqDesktopWindowControls } from '#lib/is-tq-desktop'
import { cn } from '#lib/utils'

export interface NowPanelProps {
  timeBlocks: TimeBlock[]
  calendarEvents: TimeBlockEvent[]
  taskMap: Map<string, Task>
  isLoading?: boolean
  /** Fixed clock for stories and tests. The live panel updates itself every minute. */
  now?: Date
  desktopWindowControls?: boolean | undefined
}

function JoinMeetingButton({
  title,
  meetingUrl,
}: {
  title: string
  meetingUrl: string
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="shrink-0"
      aria-label={`Join ${title}`}
      onClick={() => window.open(meetingUrl, '_blank', 'noopener,noreferrer')}
    >
      Join
    </Button>
  )
}

function getActivityStatusClassName(isOverrun: boolean): string {
  return isOverrun
    ? 'text-xs font-medium text-destructive'
    : 'text-xs text-muted-foreground'
}

export function NowPanel({
  timeBlocks,
  calendarEvents,
  taskMap,
  isLoading = false,
  now: fixedNow,
  desktopWindowControls = hasTqDesktopWindowControls(),
}: NowPanelProps) {
  const [clockNow, setClockNow] = useState(() => fixedNow ?? new Date())

  useEffect(() => {
    if (fixedNow != null) return

    const intervalId = window.setInterval(() => {
      setClockNow(new Date())
    }, 60_000)
    return () => {
      window.clearInterval(intervalId)
    }
  }, [fixedNow])

  const now = fixedNow ?? clockNow
  const model = useMemo(
    () =>
      buildNowPanelModel({ now, timeBlocks, calendarEvents, tasks: taskMap }),
    [now, timeBlocks, calendarEvents, taskMap],
  )

  return (
    <section
      aria-label="Now"
      className="sticky top-0 z-10 shrink-0 border-b border-border bg-background px-3 py-2"
    >
      <div
        className={cn(
          'mb-1',
          desktopWindowControls &&
            'electron-drag-region -mx-3 -mt-2 flex h-7 items-center px-3',
        )}
      >
        <h2
          className={cn(
            'text-xs font-semibold uppercase tracking-wide text-muted-foreground',
            desktopWindowControls && 'pl-16',
          )}
        >
          Now
        </h2>
      </div>

      {isLoading ? (
        <div className="py-1 text-sm text-muted-foreground">Loading…</div>
      ) : (
        <>
          <div className="divide-y divide-border">
            {model.activities.map((activity) =>
              activity.kind === 'task' ? (
                <TaskRowAppearance
                  key={activity.key}
                  task={activity.task}
                  size="large"
                  belowMetadata={
                    <div
                      className={getActivityStatusClassName(activity.isOverrun)}
                    >
                      {activity.statusLabel}
                    </div>
                  }
                />
              ) : (
                <div
                  key={activity.key}
                  className={
                    activity.meetingUrl == null
                      ? 'flex min-h-10 items-baseline justify-between gap-3 py-2'
                      : 'flex min-h-10 items-center justify-between gap-3 py-2'
                  }
                >
                  <span className="min-w-0 break-words text-base font-medium">
                    {activity.title}
                  </span>
                  {activity.meetingUrl == null ? (
                    <span
                      className={`shrink-0 ${getActivityStatusClassName(activity.isOverrun)}`}
                    >
                      {activity.statusLabel}
                    </span>
                  ) : (
                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className={getActivityStatusClassName(
                          activity.isOverrun,
                        )}
                      >
                        {activity.statusLabel}
                      </span>
                      <JoinMeetingButton
                        title={activity.title}
                        meetingUrl={activity.meetingUrl}
                      />
                    </div>
                  )}
                </div>
              ),
            )}
          </div>

          {model.activities.length === 0 && model.emptyState != null && (
            <div className="py-1 text-sm text-muted-foreground">
              {model.emptyState === 'no-time-blocks-today'
                ? 'No time blocks today'
                : 'No block now'}
            </div>
          )}

          {model.nextEvent != null && (
            <div
              className={
                model.nextEvent.isWarning
                  ? 'mt-2 -mx-3 flex items-center justify-between gap-3 border-t border-destructive/30 bg-destructive/10 px-3 py-1.5 text-sm text-destructive'
                  : 'mt-2 -mx-3 flex items-center justify-between gap-3 border-t border-border px-3 py-1.5 text-sm'
              }
            >
              <div className="min-w-0">
                <span className="font-medium">
                  Next: {model.nextEvent.title}
                </span>{' '}
                <span
                  className={
                    model.nextEvent.isWarning
                      ? 'font-semibold'
                      : 'text-muted-foreground'
                  }
                >
                  in {String(model.nextEvent.minutesUntil)} min
                </span>
              </div>
              {model.nextEvent.meetingUrl != null && (
                <JoinMeetingButton
                  title={model.nextEvent.title}
                  meetingUrl={model.nextEvent.meetingUrl}
                />
              )}
            </div>
          )}
        </>
      )}
    </section>
  )
}
