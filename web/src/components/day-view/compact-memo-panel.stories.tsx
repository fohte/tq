import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { CompactMemoPanel } from '#components/day-view/compact-memo-panel'
import { makeMemo } from '#hooks/memo-test-fixtures'
import type { SaveMemoInput } from '#hooks/use-memos'

const meta = {
  title: 'Day View/CompactMemoPanel',
  component: CompactMemoPanel,
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    context: 'work',
    memo: makeMemo({
      content: '- Revisit the export flow\n- Ask about the new schedule view',
      revision: 3,
    }),
    onSave: fn((input: SaveMemoInput) =>
      Promise.resolve(
        makeMemo({ content: input.content, revision: input.revision + 1 }),
      ),
    ),
  },
} satisfies Meta<typeof CompactMemoPanel>

export default meta
type Story = StoryObj<typeof meta>

export const WithNotes: Story = {
  name: 'the work memo shows a few notes in its fixed editor area',
}
