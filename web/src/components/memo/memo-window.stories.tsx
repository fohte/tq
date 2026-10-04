import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { MemoWindow } from '#components/memo/memo-window'
import { makeMemo } from '#hooks/memo-test-fixtures'
import type { SaveMemoInput } from '#hooks/use-memos'

const meta = {
  title: 'Memo/MemoWindow',
  component: MemoWindow,
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    context: 'work',
    memo: makeMemo({
      content:
        '# Notes\n\n- Review the next release plan\n- Capture follow-up questions\n\nWrite a thought here and it will be saved automatically.',
      revision: 3,
    }),
    onSave: fn((input: SaveMemoInput) =>
      Promise.resolve(
        makeMemo({ content: input.content, revision: input.revision + 1 }),
      ),
    ),
  },
} satisfies Meta<typeof MemoWindow>

export default meta
type Story = StoryObj<typeof meta>

export const Notes: Story = {
  name: 'the window shows the full work memo editor',
}

export const Loading: Story = {
  name: 'the window shows a loading message while the memo is fetched',
  args: {
    memo: undefined,
    isLoading: true,
  },
}

export const LoadError: Story = {
  name: 'the window shows an unavailable message after a load error',
  args: {
    memo: undefined,
    loadError: true,
  },
}
