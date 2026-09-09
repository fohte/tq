import { PreviewCard as PreviewCardPrimitive } from '@base-ui/react/preview-card'
import { useRef, useState } from 'react'

import type { TaskPreviewChipTask } from '#components/task/task-preview-chip'
import { TimeBlockPreviewCard } from '#components/task/time-block-preview-card'
import {
  PreviewCard,
  PreviewCardPopup,
  PreviewCardPortal,
  PreviewCardPositioner,
  PreviewCardTrigger,
} from '#components/ui/preview-card'
import { useRemoveFromDayQueue } from '#hooks/use-queues'
import { useTask } from '#hooks/use-tasks'
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
  const [open, setOpen] = useState(false)
  const { onDelete, isDeleting } = useRemoveFromDayQueue(
    taskId,
    formatLocalDate(new Date(block.startTime)),
    { enabled: open },
  )
  const { data: task, isError: isTaskError } = useTask(taskId, {
    enabled: open,
  })

  return (
    <TimeBlockPreviewPopup
      task={task ?? null}
      isTaskError={isTaskError}
      block={block}
      onDelete={onDelete}
      isDeleting={isDeleting}
      onOpenChange={setOpen}
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
  const [open, setOpen] = useState(false)
  const { onDelete, isDeleting } = useDeleteManualTimeBlock(taskId, blockId)
  const { data: task, isError: isTaskError } = useTask(taskId, {
    enabled: open,
  })

  return (
    <TimeBlockPreviewPopup
      task={task ?? null}
      isTaskError={isTaskError}
      block={block}
      onDelete={onDelete}
      isDeleting={isDeleting}
      onOpenChange={setOpen}
    >
      {children}
    </TimeBlockPreviewPopup>
  )
}

// Closes the card on the trigger's own pointerdown so it doesn't obstruct a
// drag that starts from the same chip.
function TimeBlockPreviewPopup({
  task,
  isTaskError,
  block,
  onDelete,
  isDeleting,
  onOpenChange,
  children,
}: {
  task: TaskPreviewChipTask | null
  isTaskError: boolean
  block: PreviewBlock
  onDelete: () => void
  isDeleting: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}) {
  const actionsRef = useRef<PreviewCardPrimitive.Root.Actions>(null)

  return (
    <PreviewCard actionsRef={actionsRef} onOpenChange={onOpenChange}>
      <PreviewCardTrigger
        render={<div className="h-full w-full" />}
        onPointerDown={() => actionsRef.current?.close()}
      >
        {children}
      </PreviewCardTrigger>
      <PreviewCardPortal>
        <PreviewCardPositioner>
          <PreviewCardPopup className="w-auto p-0">
            <TimeBlockPreviewCard
              task={task}
              isTaskError={isTaskError}
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
