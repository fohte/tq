import { SettingsRow } from '#components/settings/settings-row'
import { Input } from '#components/ui/input'
import { Panel } from '#components/ui/panel'
import { SectionHeading } from '#components/ui/section-heading'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#components/ui/select'
import { useSessionOpenSettings } from '#hooks/use-session-open-settings'
import { selectValueHandler } from '#lib/form-utils'

const LOCAL_CONTEXT_VALUES = ['', 'work', 'personal'] as const

export function SessionOpenSettingsPanel() {
  const [settings, updateSettings] = useSessionOpenSettings()

  return (
    <div className="flex flex-col gap-2.5">
      <SectionHeading level={3}>session open</SectionHeading>
      <Panel>
        <div className="divide-y divide-border">
          <SettingsRow
            label="This machine's context"
            description="このマシンの context。設定すると、他の context のセッション行は開けなくなる。未設定なら常に開ける"
          >
            <Select
              value={settings.localContext ?? ''}
              onValueChange={selectValueHandler((value) => {
                updateSettings({ localContext: value === '' ? null : value })
              }, LOCAL_CONTEXT_VALUES)}
            >
              <SelectTrigger size="sm">
                <SelectValue placeholder="未設定" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">未設定</SelectItem>
                <SelectItem value="work">work</SelectItem>
                <SelectItem value="personal">personal</SelectItem>
              </SelectContent>
            </Select>
          </SettingsRow>

          <SettingsRow
            label="Focus URL template"
            description="稼働中セッションを開くときに展開する URL。{sessionId} が実際の id に置き換わる。未設定なら claude --resume コマンドをコピーする"
          >
            <Input
              type="text"
              value={settings.focusUrlTemplate ?? ''}
              onChange={(e) => {
                updateSettings({
                  focusUrlTemplate:
                    e.target.value === '' ? null : e.target.value,
                })
              }}
              placeholder="hammerspoon://cc-focus?session={sessionId}"
              className="h-7 w-72 font-mono text-xs"
            />
          </SettingsRow>

          <SettingsRow
            label="Resume URL template"
            description="終了済みセッションを開き直すときに展開する URL。{sessionId} が実際の id に置き換わる。未設定なら claude --resume コマンドをコピーする"
          >
            <Input
              type="text"
              value={settings.resumeUrlTemplate ?? ''}
              onChange={(e) => {
                updateSettings({
                  resumeUrlTemplate:
                    e.target.value === '' ? null : e.target.value,
                })
              }}
              placeholder="hammerspoon://cc-resume?session={sessionId}"
              className="h-7 w-72 font-mono text-xs"
            />
          </SettingsRow>
        </div>
      </Panel>
    </div>
  )
}
