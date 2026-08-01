import { KeybindHint } from '#components/ui/keybind-hint'
import { Panel } from '#components/ui/panel'
import { SectionHeading } from '#components/ui/section-heading'
import { allKeybindings } from '#lib/keybindings'

export function KeybindingsList() {
  return (
    <div className="flex flex-col gap-2.5">
      <SectionHeading level={3}>keybindings</SectionHeading>
      <Panel>
        <div className="grid grid-cols-1 gap-x-6 gap-y-3 p-4 sm:grid-cols-2">
          {allKeybindings.map((keybinding) => (
            <div key={keybinding.id} className="flex items-center gap-3">
              <KeybindHint variant="boxed" className="shrink-0">
                {keybinding.keys}
              </KeybindHint>
              <span className="text-sm text-muted-foreground">
                {keybinding.description}
              </span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}
