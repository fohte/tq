import { HelpPopover } from '#components/ui/help-popover'
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
  return (
    <HelpPopover
      label="Show title shortcut help"
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
      className={className}
      popupClassName="w-80 p-3 font-sans"
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
    </HelpPopover>
  )
}
