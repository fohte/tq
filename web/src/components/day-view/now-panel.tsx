import { Button } from '@fohte/ui/button'
import type { CSSProperties, Ref } from 'react'

import type { NowPanelModel } from '#components/day-view/now-panel-model'
import { TaskRowAppearance } from '#components/task/task-row-appearance'
import { hasTqDesktopWindowControls } from '#lib/is-tq-desktop'
import { cn } from '#lib/utils'

export interface NowPanelProps {
  model: NowPanelModel
  isLoading?: boolean
  desktopWindowControls?: boolean | undefined
  compact?: boolean | undefined
  panelRef?: Ref<HTMLElement> | undefined
  scrollableContentRef?: Ref<HTMLDivElement> | undefined
  scrollableContentMaxHeight?: number | undefined
}

interface NowPanelContentStyle extends CSSProperties {
  '--now-panel-content-max-height': string
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
  model,
  isLoading = false,
  desktopWindowControls = hasTqDesktopWindowControls(),
  compact = false,
  panelRef,
  scrollableContentRef,
  scrollableContentMaxHeight,
}: NowPanelProps) {
  const nextEventBanner =
    model.nextEvent == null ? null : (
      <div
        className={
          model.nextEvent.isWarning
            ? 'mt-2 -mx-3 flex items-center justify-between gap-3 border-t border-destructive/30 bg-destructive/10 px-3 py-1.5 text-sm text-destructive'
            : 'mt-2 -mx-3 flex items-center justify-between gap-3 border-t border-border px-3 py-1.5 text-sm'
        }
      >
        <div className="min-w-0">
          <span className="font-medium">Next: {model.nextEvent.title}</span>{' '}
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
    )
  return (
    <section
      ref={panelRef}
      aria-label="Now"
      className={cn(
        'shrink-0 border-b border-border bg-background px-3',
        compact ? 'py-0' : 'py-2',
      )}
    >
      {desktopWindowControls && (
        <div
          className={cn('electron-titlebar-bar -mx-3', !compact && '-mt-2')}
        />
      )}

      <div
        ref={scrollableContentRef}
        data-testid={
          scrollableContentRef == null ? undefined : 'now-panel-content'
        }
        className={cn(
          'min-w-0',
          compact && scrollableContentMaxHeight != null && '-mx-3 px-3',
          scrollableContentMaxHeight == null
            ? undefined
            : 'max-h-(--now-panel-content-max-height) overflow-y-auto',
        )}
        style={
          scrollableContentMaxHeight == null
            ? undefined
            : ({
                '--now-panel-content-max-height': `${String(scrollableContentMaxHeight)}px`,
              } as NowPanelContentStyle)
        }
      >
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
                    size={compact ? 'default' : 'large'}
                    metadataLeading={
                      compact ? (
                        <span
                          className={getActivityStatusClassName(
                            activity.isOverrun,
                          )}
                        >
                          {activity.statusLabel}
                        </span>
                      ) : undefined
                    }
                    belowMetadata={
                      compact ? undefined : (
                        <div
                          className={getActivityStatusClassName(
                            activity.isOverrun,
                          )}
                        >
                          {activity.statusLabel}
                        </div>
                      )
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

            {compact && nextEventBanner}
          </>
        )}
      </div>
      {!compact && !isLoading && nextEventBanner}
    </section>
  )
}
