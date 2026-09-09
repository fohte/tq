import { PreviewCard as PreviewCardPrimitive } from '@base-ui/react/preview-card'
import { useRef } from 'react'

import { TimeBlockCard } from '#components/task/time-block-card'
import {
  PreviewCard,
  PreviewCardPopup,
  PreviewCardPortal,
  PreviewCardPositioner,
  PreviewCardTrigger,
} from '#components/ui/preview-card'
import { useRemoveFromDayQueue } from '#hooks/use-queues'
import type { TimeBlock } from '#hooks/use-time-blocks'
import { useDeleteManualTimeBlock } from '#hooks/use-time-blocks'
import type { CalendarEventProps } from '#lib/calendar-utils'
import { formatLocalDate } from '#lib/date-range'

interface PreviewableEvent {
  id: string
  start: Date | null
  end: Date | null
  extendedProps: CalendarEventProps
}

type PreviewBlock = Pick<TimeBlock, 'startTime' | 'endTime' | 'isAutoScheduled'>

/**
 * Wraps a calendar chip with a hover card for its time block, so it can be
 * deleted without opening the task detail page. Only manual/auto/completed
 * task blocks carry a taskId (schedule and gcal events never do), and a
 * redacted block hides its own content for the same reason it shouldn't
 * reveal it here either.
 */
export function TimeBlockPreviewTrigger({
  event,
  children,
}: {
  event: PreviewableEvent
  children: React.ReactNode
}) {
  const { taskId, redacted, isAutoScheduled } = event.extendedProps

  if (
    taskId == null ||
    redacted === true ||
    event.start == null ||
    event.end == null
  ) {
    return children
  }

  const block: PreviewBlock = {
    startTime: event.start.toISOString(),
    endTime: event.end.toISOString(),
    isAutoScheduled: isAutoScheduled ?? false,
  }

  return isAutoScheduled === true ? (
    <AutoTimeBlockPreview taskId={taskId} block={block}>
      {children}
    </AutoTimeBlockPreview>
  ) : (
    <ManualTimeBlockPreview taskId={taskId} blockId={event.id} block={block}>
      {children}
    </ManualTimeBlockPreview>
  )
}

function AutoTimeBlockPreview({
  taskId,
  block,
  children,
}: {
  taskId: string
  block: PreviewBlock
  children: React.ReactNode
}) {
  const { onDelete, isDeleting } = useRemoveFromDayQueue(
    taskId,
    formatLocalDate(new Date(block.startTime)),
  )

  return (
    <TimeBlockPreviewPopup
      block={block}
      onDelete={onDelete}
      isDeleting={isDeleting}
    >
      {children}
    </TimeBlockPreviewPopup>
  )
}

function ManualTimeBlockPreview({
  taskId,
  blockId,
  block,
  children,
}: {
  taskId: string
  blockId: string
  block: PreviewBlock
  children: React.ReactNode
}) {
  const { onDelete, isDeleting } = useDeleteManualTimeBlock(taskId, blockId)

  return (
    <TimeBlockPreviewPopup
      block={block}
      onDelete={onDelete}
      isDeleting={isDeleting}
    >
      {children}
    </TimeBlockPreviewPopup>
  )
}

/**
 * The trigger's `render` element is a transparent full-size div, not the
 * chip itself: EventBlock's own div fills its FullCalendar-provided harness
 * via `h-full`, so this wrapper must match that sizing instead of adding a
 * visible box around it.
 *
 * Closing on the trigger's own pointerdown (rather than e.g. FullCalendar's
 * eventDragStart) is enough to keep the card from covering a drag in
 * progress: a drag can only start from a pointerdown on this same chip, and
 * this only ever affects this chip's own card. `close()` is a no-op if the
 * card isn't open.
 */
function TimeBlockPreviewPopup({
  block,
  onDelete,
  isDeleting,
  children,
}: {
  block: PreviewBlock
  onDelete: () => void
  isDeleting: boolean
  children: React.ReactNode
}) {
  const actionsRef = useRef<PreviewCardPrimitive.Root.Actions>(null)

  return (
    <PreviewCard actionsRef={actionsRef}>
      <PreviewCardTrigger
        render={<div className="h-full w-full" />}
        onPointerDown={() => actionsRef.current?.close()}
      >
        {children}
      </PreviewCardTrigger>
      <PreviewCardPortal>
        <PreviewCardPositioner>
          <PreviewCardPopup className="w-auto p-0">
            <TimeBlockCard
              block={block}
              onDelete={onDelete}
              isDeleting={isDeleting}
            />
          </PreviewCardPopup>
        </PreviewCardPositioner>
      </PreviewCardPortal>
    </PreviewCard>
  )
}
