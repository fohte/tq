import { useCallback, useEffect, useRef, useState } from 'react'

import type { CalendarChangeFeedback } from '#components/calendar/calendar-change-feedback-popup'
import type { TimeBlock, useUpdateTimeBlock } from '#hooks/use-time-blocks'

const CHANGE_FEEDBACK_DURATION_MS = 5000

interface TimeBlockChangeInfo {
  eventId: string
  newStart: Date
  newEnd: Date
  oldStart: Date
  oldEnd: Date
  el: HTMLElement
  revert: () => void
}

export function useCalendarChangeFeedback(
  timeBlocksData: TimeBlock[] | undefined,
  updateTimeBlock: ReturnType<typeof useUpdateTimeBlock>,
) {
  const [changeFeedback, setChangeFeedback] =
    useState<CalendarChangeFeedback | null>(null)
  const anchorRef = useRef<HTMLElement | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const showChangeFeedback = useCallback(
    (el: HTMLElement, feedback: CalendarChangeFeedback) => {
      anchorRef.current = el
      setChangeFeedback(feedback)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        setChangeFeedback(null)
      }, CHANGE_FEEDBACK_DURATION_MS)
    },
    [],
  )

  const undoTimeBlockChange = useCallback(
    (
      eventId: string,
      oldStart: Date,
      oldEnd: Date,
      oldIsAutoScheduled: boolean | undefined,
    ) => {
      setChangeFeedback(null)
      updateTimeBlock.mutate(
        {
          id: eventId,
          startTime: oldStart.toISOString(),
          endTime: oldEnd.toISOString(),
          ...(oldIsAutoScheduled !== undefined
            ? { isAutoScheduled: oldIsAutoScheduled }
            : {}),
        },
        {
          onError: () => {
            if (anchorRef.current) {
              showChangeFeedback(anchorRef.current, { kind: 'error' })
            }
          },
        },
      )
    },
    [updateTimeBlock, showChangeFeedback],
  )

  const handleTimeBlockChange = useCallback(
    ({
      eventId,
      newStart,
      newEnd,
      oldStart,
      oldEnd,
      el,
      revert,
    }: TimeBlockChangeInfo) => {
      // Captured before the mutation's optimistic update overwrites this
      // block's isAutoScheduled to false, so undo can restore the flag the
      // block actually had before this drag/resize.
      const oldIsAutoScheduled = timeBlocksData?.find(
        (b) => b.id === eventId,
      )?.isAutoScheduled
      updateTimeBlock.mutate(
        {
          id: eventId,
          startTime: newStart.toISOString(),
          endTime: newEnd.toISOString(),
          isAutoScheduled: false,
        },
        {
          onError: () => {
            revert()
            showChangeFeedback(el, { kind: 'error' })
          },
          onSuccess: () => {
            showChangeFeedback(el, {
              kind: 'undo',
              onUndo: () => {
                undoTimeBlockChange(
                  eventId,
                  oldStart,
                  oldEnd,
                  oldIsAutoScheduled,
                )
              },
            })
          },
        },
      )
    },
    [updateTimeBlock, showChangeFeedback, undoTimeBlockChange, timeBlocksData],
  )

  const dismissChangeFeedback = useCallback(() => {
    setChangeFeedback(null)
  }, [])

  return {
    changeFeedback,
    changeFeedbackAnchorRef: anchorRef,
    handleTimeBlockChange,
    dismissChangeFeedback,
  }
}
