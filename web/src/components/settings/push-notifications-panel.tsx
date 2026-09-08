import { SettingsRow } from '#components/settings/settings-row'
import { Badge } from '#components/ui/badge'
import { Button } from '#components/ui/button'
import { Panel } from '#components/ui/panel'
import { SectionHeading } from '#components/ui/section-heading'
import type {
  PushAction,
  PushNotificationsStatus,
} from '#hooks/use-push-notifications'

export interface PushNotificationsPanelProps {
  status: PushNotificationsStatus
  context: 'work' | 'personal'
  pending: PushAction | null
  testSent: boolean
  error: string | null
  onEnable: () => void
  onDisable: () => void
  onTest: () => void
  onReinstall: () => void
}

function describeStatus(
  status: PushNotificationsStatus,
  context: 'work' | 'personal',
): string {
  switch (status) {
    case 'unsupported':
      return 'この端末では Web Push を使えない。iOS では 共有 → ホーム画面に追加 でインストールし、そこから開き直すと有効化できる'
    case 'denied':
      return '通知がブロックされている。ブラウザと OS の設定でこのサイトの通知を許可すると有効化できる'
    default:
      return `タスクの通知をこの端末に届ける。購読はこのマシンの context (${context}) で登録され、別の context のタスクの通知は届かない`
  }
}

export function PushNotificationsPanel({
  status,
  context,
  pending,
  testSent,
  error,
  onEnable,
  onDisable,
  onTest,
  onReinstall,
}: PushNotificationsPanelProps) {
  const renderControl = () => {
    switch (status) {
      case 'loading':
        return <span className="text-xs text-muted-foreground">確認中…</span>
      case 'unsupported':
        return <span className="text-xs text-muted-foreground">利用不可</span>
      case 'denied':
        return <span className="text-xs text-destructive">拒否済み</span>
      case 'disabled':
        return (
          <Button size="sm" onClick={onEnable} disabled={pending === 'enable'}>
            {pending === 'enable' ? '有効化中…' : '有効にする'}
          </Button>
        )
      case 'enabled':
        return (
          <>
            <Badge variant="secondary">{context}</Badge>
            <Button
              variant="destructive"
              size="sm"
              onClick={onDisable}
              disabled={pending === 'disable'}
            >
              {pending === 'disable' ? '無効化中…' : '無効にする'}
            </Button>
          </>
        )
    }
  }

  return (
    <div className="flex flex-col gap-2.5">
      <SectionHeading level={3}>notifications</SectionHeading>

      <Panel>
        <div className="divide-y divide-border">
          <SettingsRow
            label="Web push"
            description={describeStatus(status, context)}
          >
            {renderControl()}
          </SettingsRow>

          {status === 'enabled' && (
            <SettingsRow
              label="Test notification"
              description="この端末にだけテスト通知を送る"
            >
              {testSent && (
                <span className="text-xs text-muted-foreground">
                  送信しました
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={onTest}
                disabled={pending === 'test'}
              >
                {pending === 'test' ? '送信中…' : '送信'}
              </Button>
            </SettingsRow>
          )}

          {status === 'enabled' && (
            <SettingsRow
              label="Service worker"
              description="通知が届かないときに、Service Worker を登録し直す"
            >
              <Button variant="outline" size="sm" onClick={onReinstall}>
                入れ直す
              </Button>
            </SettingsRow>
          )}
        </div>
      </Panel>

      {error != null && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
