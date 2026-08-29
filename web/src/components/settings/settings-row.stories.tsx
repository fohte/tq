import type { Meta, StoryObj } from '@storybook/react-vite'

import { SettingsRow } from '#components/settings/settings-row'
import { Input } from '#components/ui/input'
import { Panel } from '#components/ui/panel'

const meta = {
  title: 'Settings/SettingsRow',
  component: SettingsRow,
  decorators: [
    (Story) => (
      <Panel className="w-full max-w-lg">
        <Story />
      </Panel>
    ),
  ],
} satisfies Meta<typeof SettingsRow>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    label: 'Working hours',
    description: 'auto-scheduler が予定を配置できる時間帯',
    children: <Input type="time" defaultValue="09:00" className="h-7 w-28" />,
  },
}

export const LongDescription: Story = {
  args: {
    label: 'Focus URL template',
    description:
      '稼働中セッションを開くときに展開する URL。{sessionId} が実際の id に置き換わる。未設定なら claude --resume コマンドをコピーする',
    children: (
      <Input
        type="text"
        placeholder="hammerspoon://cc-focus?session={sessionId}"
        className="h-7 w-72 font-mono text-xs"
      />
    ),
  },
}
