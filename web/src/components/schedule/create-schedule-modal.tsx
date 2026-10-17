import {
  Dialog,
  DialogOverlay,
  DialogPopup,
  DialogPortal,
} from '@fohte/ui/dialog'

import { ScheduleModalDesktopPanel } from '#components/schedule/create-schedule-modal-desktop-panel'
import { ScheduleModalMobilePanel } from '#components/schedule/create-schedule-modal-mobile-panel'
import { useCreateScheduleModalState } from '#components/schedule/use-create-schedule-modal-state'
import type { Schedule } from '#hooks/use-schedules'
import { formatLocalDate } from '#lib/date-range'

export type { RecurrenceType } from '#components/schedule/schedule-modal-form-options'
export {
  dayLabels,
  toggleWeekday,
  WeekdayToggleRow,
} from '#components/schedule/schedule-modal-form-options'

interface CreateScheduleModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Presence switches the modal into edit mode. */
  schedule?: Schedule | undefined
  /** Date selected in the calendar when creating a schedule. */
  defaultStartDate?: string
}

export function CreateScheduleModal({
  open,
  onOpenChange,
  schedule,
  defaultStartDate = formatLocalDate(new Date()),
}: CreateScheduleModalProps) {
  const { panelProps } = useCreateScheduleModalState({
    open,
    onOpenChange,
    schedule,
    defaultStartDate,
  })
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      panelProps.handleSubmit()
    }
  }

  return (
    <Dialog open={open} onOpenChange={panelProps.handleOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPopup onKeyDown={handleKeyDown}>
          <ScheduleModalDesktopPanel {...panelProps} />
          <ScheduleModalMobilePanel {...panelProps} />
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  )
}
