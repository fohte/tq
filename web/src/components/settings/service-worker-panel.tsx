import { SettingsRow } from '#components/settings/settings-row'
import { Button } from '#components/ui/button'
import { Panel } from '#components/ui/panel'
import { SectionHeading } from '#components/ui/section-heading'

export interface ServiceWorkerPanelProps {
  onReinstall: () => void
}

export function ServiceWorkerPanel({ onReinstall }: ServiceWorkerPanelProps) {
  return (
    <div className="flex flex-col gap-2.5">
      <SectionHeading level={3}>service worker</SectionHeading>

      <Panel>
        <div className="divide-y divide-border">
          <SettingsRow
            label="Service worker"
            description="アプリの動作がおかしいときに、Service Worker を登録し直す"
          >
            <Button variant="outline" size="sm" onClick={onReinstall}>
              再インストール
            </Button>
          </SettingsRow>
        </div>
      </Panel>
    </div>
  )
}
