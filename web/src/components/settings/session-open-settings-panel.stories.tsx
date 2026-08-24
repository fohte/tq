import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'

import { SessionOpenSettingsPanel } from '#components/settings/session-open-settings-panel'
import { STORAGE_KEY } from '#hooks/use-session-open-settings'

// Reset on every render so this story's initial state and its own
// `TypingAFocusTemplateUpdatesTheInput` assertion stay deterministic
// regardless of what else last wrote to this key in the same browser
// context (mirrors session-row.stories.tsx's `SessionRowStory`).
function WrappedSessionOpenSettingsPanel() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      localContext: null,
      focusUrlTemplate: null,
      resumeUrlTemplate: null,
    }),
  )

  return (
    <div className="w-3xl">
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

export const Default: Story = {}

export const TypingAFocusTemplateUpdatesTheInput: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByPlaceholderText(
      'hammerspoon://cc-focus?session={sessionId}',
    )

    // user-event treats `{` as special key syntax, so a literal `{` needs to
    // be escaped by doubling it (the matching `}` needs no escaping):
    // https://testing-library.com/docs/user-event/utility/#special-characters
    await userEvent.type(input, 'tq://focus?session={{sessionId}')

    await waitFor(async () => {
      await expect(input).toHaveValue('tq://focus?session={sessionId}')
    })
  },
}
