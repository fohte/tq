import type { Meta, StoryObj } from '@storybook/react-vite'
import { useRef } from 'react'

import { getSearchSyntaxHelpSections } from '#components/search/search-syntax-help-data'
import { SearchSyntaxHelpPopover } from '#components/search/search-syntax-help-popover'

function AnchoredPopoverExample({
  open,
  sections,
}: {
  open: boolean
  sections: ReturnType<typeof getSearchSyntaxHelpSections>
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="w-full max-w-96 border border-border bg-background p-3">
      <input
        ref={inputRef}
        autoFocus={open}
        value=""
        readOnly
        placeholder="Filter…"
        aria-label="Filter query"
        className="w-full border-0 bg-transparent font-mono text-sm outline-none placeholder:text-muted-foreground"
      />
      <SearchSyntaxHelpPopover
        anchor={inputRef}
        open={open}
        sections={sections}
      />
    </div>
  )
}

const meta = {
  title: 'Search/SearchSyntaxHelpPopover',
  component: AnchoredPopoverExample,
  args: {
    open: false,
    sections: getSearchSyntaxHelpSections({ audience: 'task-filter' }),
  },
  parameters: { layout: 'centered' },
} satisfies Meta<typeof AnchoredPopoverExample>

export default meta
type Story = StoryObj<typeof meta>

export const Closed: Story = {
  name: 'the syntax help popover is closed beside the search controls',
}

export const Open: Story = {
  name: 'the syntax help popover displays search targets and filters',
  args: { open: true },
}
