import { CircleHelp } from 'lucide-react'
import { useId, useRef, useState } from 'react'

import { AnchoredPopup } from '#components/ui/anchored-popup'
import { Button } from '#components/ui/button'
import { taskShorthandHelpItems } from '#lib/task-shorthand'

export function TaskShorthandHelp({
  className,
  defaultOpen = false,
  onOpenChange,
}: {
  className?: string
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [open, setOpen] = useState(defaultOpen)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popupId = useId()

  const updateOpen = (nextOpen: boolean) => {
    setOpen(nextOpen)
    onOpenChange?.(nextOpen)
  }

  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Show title shortcut help"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popupId : undefined}
        onClick={() => {
          updateOpen(!open)
        }}
        className={className}
      >
        <CircleHelp />
      </Button>
      <AnchoredPopup
        id={popupId}
        open={open}
        onOpenChange={updateOpen}
        anchor={triggerRef}
        align="end"
        className="w-80 p-3 font-sans"
      >
        <div>
          <h2 className="text-sm font-semibold text-popover-foreground">
            Title shortcuts
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Type a token followed by a space to apply it.
          </p>
          <dl className="mt-3 grid gap-2">
            {taskShorthandHelpItems.map((item) => (
              <div key={item.trigger} className="flex gap-2">
                <dt className="w-8 shrink-0">
                  <code className="font-mono text-xs font-semibold text-foreground">
                    {item.trigger}
                  </code>
                </dt>
                <dd className="min-w-0 flex-1 text-xs text-popover-foreground">
                  <p>{item.description}</p>
                  <div className="mt-0.5 flex flex-wrap gap-x-2 text-muted-foreground">
                    {item.examples.map((example) => (
                      <code key={example} className="font-mono">
                        {example}
                      </code>
                    ))}
                  </div>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </AnchoredPopup>
    </>
  )
}
