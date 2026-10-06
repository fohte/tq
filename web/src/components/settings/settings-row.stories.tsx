import { Input } from '@fohte/ui/input'
import { Panel } from '@fohte/ui/panel'
import type { Meta, StoryObj } from '@storybook/react-vite'

import { SettingsRow } from '#components/settings/settings-row'

const meta = {
  title: 'Settings/SettingsRow',
  component: SettingsRow,
  decorators: [
    (Story) => (
      <Panel padding="none" className="w-full max-w-lg">
        <Story />
      </Panel>
    ),
  ],
} satisfies Meta<typeof SettingsRow>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'a settings row pairs a reminder time with its description',
  args: {
    label: 'Reminder time',
    description: 'Choose when to receive a reminder.',
    children: <Input type="time" defaultValue="09:00" className="h-7 w-28" />,
  },
}

export const LongDescription: Story = {
  name: 'a settings row wraps a long explanation beside its field',
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
