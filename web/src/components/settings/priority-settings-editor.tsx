import { Button } from '@fohte/ui/button'
import { Input } from '@fohte/ui/input'
import { Panel } from '@fohte/ui/panel'
import { ArrowDown, ArrowUp, Save } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Textarea } from '#components/ui/textarea'
import type {
  PrioritySetting,
  UpdatePrioritySettingsInput,
} from '#hooks/use-priority-settings'

function inDisplayOrder(settings: PrioritySetting[]) {
  return [...settings].sort((left, right) => left.sortOrder - right.sortOrder)
}

export function PrioritySettingsEditor({
  settings,
  isSaving,
  saveError,
  onSave,
}: {
  settings: PrioritySetting[]
  isSaving: boolean
  saveError: boolean
  onSave: (settings: UpdatePrioritySettingsInput) => void
}) {
  const [draft, setDraft] = useState(() => inDisplayOrder(settings))

  useEffect(() => {
    setDraft(inDisplayOrder(settings))
  }, [settings])

  const hasChanges = draft.some((setting, index) => {
    const original = settings.find(
      (candidate) => candidate.priority === setting.priority,
    )
    return (
      original == null ||
      original.name !== setting.name ||
      original.description !== setting.description ||
      original.sortOrder !== index
    )
  })
  const hasInvalidName = draft.some((setting) => setting.name.trim() === '')
  const inboxName = draft.find((setting) => setting.priority === null)?.name

  function updateSetting(
    priority: PrioritySetting['priority'],
    update: Partial<Pick<PrioritySetting, 'name' | 'description'>>,
  ) {
    setDraft((current) =>
      current.map((setting) =>
        setting.priority === priority ? { ...setting, ...update } : setting,
      ),
    )
  }

  function moveSetting(index: number, direction: -1 | 1) {
    setDraft((current) => {
      const nextIndex = index + direction
      if (nextIndex < 0 || nextIndex >= current.length) return current
      const next = [...current]
      const movedSetting = next[index]
      const adjacentSetting = next[nextIndex]
      if (movedSetting == null || adjacentSetting == null) return current
      next[index] = adjacentSetting
      next[nextIndex] = movedSetting
      return next
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {inboxName != null && (
        <p className="text-sm text-muted-foreground">
          {inboxName} より上にある段階は、日付がなくても queue candidates
          に表示されます。
        </p>
      )}

      <Panel padding="none">
        <div className="divide-y divide-border">
          {draft.map((setting, index) => (
            <div key={setting.priority ?? 'inbox'} className="flex gap-3 p-4">
              <div className="flex flex-col justify-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`${setting.name} を上へ`}
                  disabled={index === 0 || isSaving}
                  onClick={() => {
                    moveSetting(index, -1)
                  }}
                >
                  <ArrowUp />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`${setting.name} を下へ`}
                  disabled={index === draft.length - 1 || isSaving}
                  onClick={() => {
                    moveSetting(index, 1)
                  }}
                >
                  <ArrowDown />
                </Button>
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Input
                  aria-label={`${setting.name} の表示名`}
                  value={setting.name}
                  disabled={isSaving}
                  onChange={(event) => {
                    updateSetting(setting.priority, {
                      name: event.target.value,
                    })
                  }}
                />
                <Textarea
                  aria-label={`${setting.name} の説明`}
                  value={setting.description}
                  disabled={isSaving}
                  rows={2}
                  onChange={(event) => {
                    updateSetting(setting.priority, {
                      description: event.target.value,
                    })
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {saveError && (
        <p role="alert" className="text-sm text-destructive">
          優先度設定を保存できませんでした
        </p>
      )}

      <div className="flex justify-end">
        <Button
          type="button"
          disabled={!hasChanges || hasInvalidName || isSaving}
          onClick={() => {
            onSave(
              draft.map((setting, sortOrder) => ({
                ...setting,
                name: setting.name.trim(),
                sortOrder,
              })),
            )
          }}
        >
          <Save />
          {isSaving ? '保存中...' : '保存'}
        </Button>
      </div>
    </div>
  )
}
