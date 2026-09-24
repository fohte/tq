import {
  getSearchSyntaxHelpSections,
  type SearchSyntaxHelpSection,
} from '#components/search/search-syntax-help-data'
import { SearchSyntaxHelpPanel } from '#components/search/search-syntax-help-panel'
import { HelpPopover } from '#components/ui/help-popover'

interface SearchSyntaxHelpPopoverProps {
  defaultOpen?: boolean
  sections?: SearchSyntaxHelpSection[]
}

export function SearchSyntaxHelpPopover({
  defaultOpen = false,
  sections = getSearchSyntaxHelpSections(),
}: SearchSyntaxHelpPopoverProps) {
  return (
    <HelpPopover
      label="Search syntax help"
      defaultOpen={defaultOpen}
      popupClassName="w-88 p-0"
    >
      <SearchSyntaxHelpPanel sections={sections} />
    </HelpPopover>
  )
}
