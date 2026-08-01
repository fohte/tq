import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'

import { Input } from '#components/ui/input'
import { Panel } from '#components/ui/panel'
import { SectionHeading } from '#components/ui/section-heading'
import { SegmentedControl } from '#components/ui/segmented-control'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#components/ui/select'
import type { SchedulingSettings } from '#hooks/use-scheduling-settings'
import {
  useSchedulingSettings,
  useUpdateSchedulingSettings,
} from '#hooks/use-scheduling-settings'
import { selectValueHandler } from '#lib/form-utils'
import { formatMinutes, parseDurationToMinutes } from '#lib/parse-duration'

type ContextValue = SchedulingSettings['defaultContext']
const CONTEXT_VALUES = [
  'work',
  'personal',
] as const satisfies readonly ContextValue[]

const AUTO_RESCHEDULE_OPTIONS = [
  { value: 'on', label: '有効' },
  { value: 'off', label: '無効' },
] as const satisfies ReadonlyArray<{ value: 'on' | 'off'; label: string }>

function SettingsRow({
  label,
  description,
  children,
}: {
  label: string
  description: string
  children: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 p-4">
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  )
}

export function SchedulingSettingsPanel() {
  const settings = useSchedulingSettings()
  const updateSettings = useUpdateSchedulingSettings()

  const [workingHoursStart, setWorkingHoursStart] = useState('')
  const [workingHoursEnd, setWorkingHoursEnd] = useState('')
  const [minimumBlockInput, setMinimumBlockInput] = useState('')

  // Re-sync only when the server value for this field actually changes, so
  // an in-flight edit in another field's onBlur (which invalidates and
  // refetches this whole query) doesn't clobber what the user is typing here.
  useEffect(() => {
    if (settings.data == null) return
    setWorkingHoursStart(settings.data.workingHoursStart)
    setWorkingHoursEnd(settings.data.workingHoursEnd)
  }, [settings.data?.workingHoursStart, settings.data?.workingHoursEnd])

  useEffect(() => {
    if (settings.data == null) return
    setMinimumBlockInput(formatMinutes(settings.data.minimumBlockMinutes))
  }, [settings.data?.minimumBlockMinutes])

  const commitWorkingHours = () => {
    if (workingHoursStart === '' || workingHoursEnd === '') return
    if (
      settings.data?.workingHoursStart === workingHoursStart &&
      settings.data.workingHoursEnd === workingHoursEnd
    ) {
      return
    }
    updateSettings.mutate({ workingHoursStart, workingHoursEnd })
  }

  const commitMinimumBlock = () => {
    const parsed = parseDurationToMinutes(minimumBlockInput)
    if (parsed == null || parsed <= 0) return
    if (settings.data?.minimumBlockMinutes === parsed) return
    updateSettings.mutate({ minimumBlockMinutes: parsed })
  }

  return (
    <div className="flex flex-col gap-2.5">
      <SectionHeading level={3}>scheduling</SectionHeading>

      {settings.isLoading ? (
        <p className="text-sm text-muted-foreground">読み込み中...</p>
      ) : settings.isSuccess ? (
        <Panel>
          <div className="divide-y divide-border">
            <SettingsRow
              label="Working hours"
              description="auto-scheduler が予定を配置できる時間帯"
            >
              <Input
                type="time"
                value={workingHoursStart}
                onChange={(e) => {
                  setWorkingHoursStart(e.target.value)
                }}
                onBlur={commitWorkingHours}
                className="h-7 w-28"
              />
              <span className="text-xs text-muted-foreground">–</span>
              <Input
                type="time"
                value={workingHoursEnd}
                onChange={(e) => {
                  setWorkingHoursEnd(e.target.value)
                }}
                onBlur={commitWorkingHours}
                className="h-7 w-28"
              />
            </SettingsRow>

            <SettingsRow
              label="Minimum block"
              description="タスクに割り当てる時間ブロックの最小単位"
            >
              <Input
                type="text"
                value={minimumBlockInput}
                onChange={(e) => {
                  setMinimumBlockInput(e.target.value)
                }}
                onBlur={commitMinimumBlock}
                placeholder="30m"
                className="h-7 w-20 font-mono"
              />
            </SettingsRow>

            <SettingsRow
              label="Reschedule on calendar change"
              description="Google Calendar の予定が変わったら自動で再配置する"
            >
              <SegmentedControl
                value={settings.data.autoRescheduleOnGcalChange ? 'on' : 'off'}
                options={AUTO_RESCHEDULE_OPTIONS}
                onChange={(value) => {
                  if (updateSettings.isPending) return
                  updateSettings.mutate({
                    autoRescheduleOnGcalChange: value === 'on',
                  })
                }}
                containerClassName="rounded-md bg-secondary p-0.5"
                activeClassName="bg-background text-foreground shadow-sm"
                inactiveClassName="text-muted-foreground hover:text-foreground"
              />
            </SettingsRow>

            <SettingsRow
              label="Default context"
              description="新規タスク・予定に既定で設定するコンテキスト"
            >
              <Select
                value={settings.data.defaultContext}
                onValueChange={selectValueHandler((value) => {
                  updateSettings.mutate({ defaultContext: value })
                }, CONTEXT_VALUES)}
              >
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="work">Work</SelectItem>
                  <SelectItem value="personal">Personal</SelectItem>
                </SelectContent>
              </Select>
            </SettingsRow>
          </div>
        </Panel>
      ) : (
        <p className="text-sm text-destructive">
          scheduling 設定の取得に失敗しました
        </p>
      )}

      {updateSettings.isError && (
        <p className="text-xs text-destructive">
          {updateSettings.error.message}
        </p>
      )}
    </div>
  )
}
