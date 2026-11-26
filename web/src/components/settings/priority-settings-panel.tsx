import { PrioritySettingsEditor } from '#components/settings/priority-settings-editor'
import { QueryStateMessage } from '#components/settings/query-state-message'
import { SectionHeading } from '#components/ui/section-heading'
import {
  usePrioritySettings,
  useUpdatePrioritySettings,
} from '#hooks/use-priority-settings'

export function PrioritySettingsPanel() {
  const settings = usePrioritySettings()
  const updateSettings = useUpdatePrioritySettings()

  return (
    <div className="flex flex-col gap-2.5">
      <SectionHeading level={3}>priority</SectionHeading>

      {settings.isLoading ? (
        <QueryStateMessage status="loading" />
      ) : settings.isSuccess ? (
        <PrioritySettingsEditor
          settings={settings.data}
          isSaving={updateSettings.isPending}
          saveError={updateSettings.isError}
          onSave={updateSettings.mutate}
        />
      ) : (
        <QueryStateMessage
          status="error"
          message="優先度設定の取得に失敗しました"
        />
      )}
    </div>
  )
}
