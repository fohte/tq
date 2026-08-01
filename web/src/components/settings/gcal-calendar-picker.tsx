import { ChevronRight } from 'lucide-react'
import { useState } from 'react'

import { GcalCalendarChecklist } from '#components/settings/gcal-calendar-checklist'
import type { IntegrationAccountView } from '#components/settings/integration-card'
import {
  useGcalCalendarsList,
  useUpdateCalendarSubscription,
} from '#hooks/use-gcal-calendars'
import { cn } from '#lib/utils'

export interface GcalCalendarPickerProps {
  account: IntegrationAccountView
}

export function GcalCalendarPicker({ account }: GcalCalendarPickerProps) {
  const [open, setOpen] = useState(false)

  const calendarsQuery = useGcalCalendarsList(account.id, open)
  const updateSubscription = useUpdateCalendarSubscription(account.id)

  return (
    <div className="pb-2">
      <button
        type="button"
        className="flex items-center gap-1 py-1 text-xs text-muted-foreground hover:text-foreground"
        onClick={() => {
          setOpen((prev) => !prev)
        }}
        aria-expanded={open}
      >
        <ChevronRight
          className={cn('size-3 transition-transform', open && 'rotate-90')}
        />
        カレンダーを選択
      </button>

      {open &&
        (calendarsQuery.isLoading ? (
          <p className="py-1.5 text-xs text-muted-foreground">読み込み中...</p>
        ) : calendarsQuery.isSuccess ? (
          <GcalCalendarChecklist
            calendars={calendarsQuery.data}
            onToggle={(calendarId, subscribed) => {
              updateSubscription.mutate({ calendarId, subscribed })
            }}
            updatingCalendarId={
              updateSubscription.isPending
                ? updateSubscription.variables.calendarId
                : null
            }
          />
        ) : (
          <p className="py-1.5 text-xs text-destructive">
            カレンダー一覧の取得に失敗しました
          </p>
        ))}
    </div>
  )
}
