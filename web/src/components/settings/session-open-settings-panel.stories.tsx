import type { Meta, StoryObj } from '@storybook/react-vite'

import { SessionOpenSettingsPanel } from '#components/settings/session-open-settings-panel'

function WrappedSessionOpenSettingsPanel() {
  return (
    <div className="w-full max-w-3xl">
      <SessionOpenSettingsPanel />
    </div>
  )
}

const meta = {
  title: 'Settings/SessionOpenSettingsPanel',
  component: WrappedSessionOpenSettingsPanel,
} satisfies Meta<typeof WrappedSessionOpenSettingsPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'the session settings show the configured session open behavior',
}
