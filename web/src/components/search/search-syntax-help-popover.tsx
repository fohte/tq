import type { RefObject } from 'react'

import {
  getSearchSyntaxHelpSections,
  type SearchSyntaxHelpSection,
} from '#components/search/search-syntax-help-data'
import { SearchSyntaxHelpPanel } from '#components/search/search-syntax-help-panel'
import { AnchoredPopup } from '#components/ui/anchored-popup'

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
    <AnchoredPopup anchor={anchor} open={open} className="w-88 p-0">
      <SearchSyntaxHelpPanel sections={sections} showFilterIcons />
    </AnchoredPopup>
  )
}
