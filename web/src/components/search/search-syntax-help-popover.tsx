import { CircleHelp } from 'lucide-react'
import { useId, useRef, useState } from 'react'

import { getSearchSyntaxHelpSections } from '#components/search/search-syntax-help-data'
import { SearchSyntaxHelpPanel } from '#components/search/search-syntax-help-panel'
import { AnchoredPopup } from '#components/ui/anchored-popup'
import { Button } from '#components/ui/button'

interface SearchSyntaxHelpPopoverProps {
  defaultOpen?: boolean
}

export function SearchSyntaxHelpPopover({
  defaultOpen = false,
}: SearchSyntaxHelpPopoverProps) {
  const [open, setOpen] = useState(defaultOpen)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popupId = useId()

  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Search syntax help"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popupId : undefined}
        onClick={() => {
          setOpen((previous) => !previous)
        }}
      >
        <CircleHelp aria-hidden="true" />
      </Button>
      <AnchoredPopup
        id={popupId}
        open={open}
        onOpenChange={setOpen}
        anchor={triggerRef}
        align="end"
        className="w-88 p-0"
      >
        <SearchSyntaxHelpPanel sections={getSearchSyntaxHelpSections()} />
      </AnchoredPopup>
    </>
  )
}
