import { useRef, useState } from 'react'

import { SidebarRemindFieldAppearance } from '#components/task/sidebar-remind-field-appearance'
import { useUpdateTask } from '#hooks/use-tasks'
import { formatReminderSummary, parseReminderInput } from '#lib/reminder-input'

export function SidebarRemindField({
  taskId,
  remindAt,
}: {
  taskId: string
  remindAt: string | null
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [query, setQuery] = useState('')
  const [parsedDate, setParsedDate] = useState<Date | null>(null)
  // Guards against an in-flight parse for a stale keystroke overwriting the
  // result of a newer one once its dynamic import resolves.
  const requestIdRef = useRef(0)

  const updateTask = useUpdateTask()

  const stopEditing = () => {
    setIsEditing(false)
    setQuery('')
    setParsedDate(null)
  }

  // A committing action (confirming a value or clearing) always wins over
  // any still-in-flight parse from an earlier action — bumping the token
  // here makes that earlier parse's eventual `.then` a no-op.
  const commit = (date: Date) => {
    requestIdRef.current++
    updateTask.mutate({ id: taskId, input: { remindAt: date.toISOString() } })
    stopEditing()
  }

  const clear = () => {
    requestIdRef.current++
    updateTask.mutate({ id: taskId, input: { remindAt: null } })
    stopEditing()
  }

  const handleQueryChange = (value: string) => {
    setQuery(value)
    const requestId = ++requestIdRef.current

    if (value.trim() === '') {
      setParsedDate(null)
      return
    }
    void parseReminderInput(value).then((date) => {
      if (requestIdRef.current !== requestId) return
      setParsedDate(date)
    })
  }

  const selectPreset = (preset: string) => {
    const requestId = ++requestIdRef.current
    void parseReminderInput(preset).then((date) => {
      if (requestIdRef.current !== requestId) return
      if (date != null) commit(date)
    })
  }

  return (
    <SidebarRemindFieldAppearance
      remindAtLabel={
        remindAt != null ? formatReminderSummary(new Date(remindAt)) : 'なし'
      }
      isEditing={isEditing}
      onOpenChange={(open) => {
        if (open) {
          setIsEditing(true)
        } else {
          stopEditing()
        }
      }}
      query={query}
      onQueryChange={handleQueryChange}
      parsedDate={parsedDate}
      onClear={clear}
      onSelectPreset={selectPreset}
      onCommit={commit}
    />
  )
}
