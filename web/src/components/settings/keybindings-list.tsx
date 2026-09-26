import { KeybindHint } from '#components/ui/keybind-hint'
import { Panel } from '#components/ui/panel'
import { SectionHeading } from '#components/ui/section-heading'
import {
  calendarKeybindings,
  filterKeybindings,
  getAllKeybindings,
  type Keybinding,
  type SearchKeybinding,
} from '#lib/keybindings'

function KeybindingGrid({ keybindings }: { keybindings: Keybinding[] }) {
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-3 p-4 sm:grid-cols-2">
      {keybindings.map((keybinding) => (
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
  )
}

export function KeybindingsList({
  searchKeybinding,
}: {
  searchKeybinding: SearchKeybinding
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <SectionHeading level={3}>keybindings</SectionHeading>
      <Panel>
        <KeybindingGrid keybindings={getAllKeybindings(searchKeybinding)} />
      </Panel>

      <SectionHeading level={3}>calendar keybindings</SectionHeading>
      <Panel>
        <KeybindingGrid keybindings={calendarKeybindings} />
      </Panel>

      <SectionHeading level={3}>filter keybindings</SectionHeading>
      <Panel>
        <KeybindingGrid keybindings={filterKeybindings} />
      </Panel>
    </div>
  )
}
