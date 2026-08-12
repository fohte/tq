import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'

import { TagFilterBar } from '#components/tag-filter-bar'
import { useTagFilter } from '#hooks/use-tag-filter'

// TagFilterBar renders nothing until a tag is selected via useTagFilter, so
// the demo exposes a button that drives the same state a click on a TAGS
// sidebar row or a mobile tag chip would.
function TagFilterBarDemo() {
  const { setTag } = useTagFilter()

  return (
    <div className="w-[400px] border border-border">
      <button
        type="button"
        className="w-full border-b border-border px-3 py-2 font-mono text-2xs text-muted-foreground"
        onClick={() => {
          setTag('dev:tq')
        }}
      >
        select #dev:tq
      </button>
      <TagFilterBar />
    </div>
  )
}

const meta = {
  title: 'UI/TagFilterBar',
  component: TagFilterBarDemo,
} satisfies Meta<typeof TagFilterBarDemo>

export default meta
type Story = StoryObj<typeof meta>

export const NoFilter: Story = {}

export const Filtered: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByText('select #dev:tq'))
    await expect(canvas.getByText('filtered by')).toBeVisible()
    await expect(canvas.getByText('dev:tq')).toBeVisible()
  },
}
