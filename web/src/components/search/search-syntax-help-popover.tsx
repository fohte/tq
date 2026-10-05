import { Popover, PopoverContent } from '@fohte/ui/popover'
import type { RefObject } from 'react'

import {
  getSearchSyntaxHelpSections,
  type SearchSyntaxHelpSection,
} from '#components/search/search-syntax-help-data'
import { SearchSyntaxHelpPanel } from '#components/search/search-syntax-help-panel'

interface SearchSyntaxHelpPopoverProps {
  anchor: RefObject<HTMLInputElement | null>
  open: boolean
  sections?: SearchSyntaxHelpSection[]
}

export function SearchSyntaxHelpPopover({
  anchor,
  open,
  sections = getSearchSyntaxHelpSections(),
}: SearchSyntaxHelpPopoverProps) {
  return (
    <Popover anchor={anchor} open={open}>
      <PopoverContent
        initialFocus={false}
        finalFocus={false}
        padding="none"
        className="w-88"
      >
        <SearchSyntaxHelpPanel sections={sections} showFilterIcons />
      </PopoverContent>
    </Popover>
  )
}
