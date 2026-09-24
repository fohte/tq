import type { Meta, StoryObj } from '@storybook/react-vite'
import { useRef } from 'react'

import { createOptionItem } from '#components/search/search-modal-result-items'
import {
  type IndexedResultGroup,
  SearchModalResultList,
} from '#components/search/search-modal-result-list'

type ResultListStoryProps = {
  state: 'initial' | 'recent' | 'empty'
}

const noOp = () => undefined
const recentGroup: IndexedResultGroup = {
  id: 'recent',
  title: 'Recently viewed',
  isVisible: () => true,
  items: [
    {
      item: createOptionItem(
        'recent:task:42',
        noOp,
        <span className="font-mono text-sm text-foreground">
          Prepare the weekly review
        </span>,
      ),
      globalIndex: 0,
    },
    {
      item: createOptionItem(
        'recent:project:142',
        noOp,
        <span className="font-mono text-sm text-foreground">
          Website refresh
        </span>,
      ),
      globalIndex: 1,
    },
  ],
}

function ResultListStory({ state }: ResultListStoryProps) {
  const listRef = useRef<HTMLDivElement>(null)
  return (
    <div className="mx-auto flex h-72 w-full max-w-160 flex-col border border-border bg-popover text-popover-foreground">
      <SearchModalResultList
        groups={state === 'recent' ? [recentGroup] : []}
        listRef={listRef}
        selectedIndex={0}
        onSelectedIndexChange={noOp}
        {...(state === 'initial'
          ? { initialMessage: 'Type to search tasks' }
          : {})}
        {...(state === 'empty'
          ? { emptyMessage: 'no results for "unknown command"' }
          : {})}
      />
    </div>
  )
}

const meta = {
  title: 'Search/SearchModalResultList',
  component: ResultListStory,
  args: { state: 'recent' },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ResultListStory>

export default meta
type Story = StoryObj<typeof meta>

export const RecentlyViewed: Story = { args: { state: 'recent' } }

export const Initial: Story = { args: { state: 'initial' } }

export const NoResults: Story = { args: { state: 'empty' } }
