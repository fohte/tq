import { ChevronRight } from 'lucide-react'
import { useState } from 'react'

import { GcalCalendarChecklist } from '#components/settings/gcal-calendar-checklist'
import type { IntegrationAccountView } from '#components/settings/integration-card'
import { QueryStateMessage } from '#components/settings/query-state-message'
import { Button } from '#components/ui/button'
import {
  useGcalCalendarsList,
  useUpdateCalendarContext,
  useUpdateCalendarSubscription,
} from '#hooks/use-gcal-calendars'
import { cn } from '#lib/utils'

export interface GcalCalendarPickerProps {
  account: IntegrationAccountView
  initialOpen?: boolean
}

export function GcalCalendarPicker({
  account,
  initialOpen = false,
}: GcalCalendarPickerProps) {
  const [open, setOpen] = useState(initialOpen)

  const calendarsQuery = useGcalCalendarsList(account.id, open)
  const updateSubscription = useUpdateCalendarSubscription(account.id)
  const updateContext = useUpdateCalendarContext(account.id)

  return (
    <div className="pb-2">
      <Button
        type="button"
        variant="ghost"
        className="h-auto min-h-0 w-fit gap-0 rounded-none border-0 bg-transparent p-0 font-sans font-normal shadow-none transition-none hover:bg-transparent active:translate-y-0 flex items-center gap-1 py-1 text-xs text-muted-foreground hover:text-foreground"
        onClick={() => {
          setOpen((prev) => !prev)
        }}
        aria-expanded={open}
      >
        <ChevronRight
          className={cn('size-3 transition-transform', open && 'rotate-90')}
        />
        カレンダーを選択
      </Button>

      {open &&
        (calendarsQuery.isLoading ? (
          <QueryStateMessage status="loading" size="xs" />
        ) : calendarsQuery.isSuccess ? (
          <GcalCalendarChecklist
            calendars={calendarsQuery.data}
            onToggle={(calendarId, subscribed) => {
              updateSubscription.mutate({ calendarId, subscribed })
            }}
            onContextChange={(calendarId, context) => {
              updateContext.mutate({ calendarId, context })
            }}
            updatingCalendarId={
              updateSubscription.isPending
                ? updateSubscription.variables.calendarId
                : null
            }
            updatingContextCalendarId={
              updateContext.isPending
                ? updateContext.variables.calendarId
                : null
            }
          />
        ) : (
          <QueryStateMessage
            status="error"
            message="カレンダー一覧の取得に失敗しました"
            size="xs"
          />
        ))}

      {(updateSubscription.isError || updateContext.isError) && (
        <p className="py-1.5 text-xs text-destructive">
          {(updateSubscription.error ?? updateContext.error)?.message}
        </p>
      )}
    </div>
  )
}
