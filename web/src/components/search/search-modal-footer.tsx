import { KeybindHint } from '#components/ui/keybind-hint'

interface SearchModalFooterProps {
  canClearContext: boolean
  canPopScope: boolean
  isHelpOpen: boolean
}

export function SearchModalFooter({
  canClearContext,
  canPopScope,
  isHelpOpen,
}: SearchModalFooterProps) {
  return (
    <div className="flex min-h-9 flex-wrap items-center gap-1.5 border-t border-border px-4 py-2 font-mono text-2xs text-muted-foreground-ghost">
      {isHelpOpen ? (
        <>
          <KeybindHint variant="boxed">Esc</KeybindHint>
          <span>back</span>
          <KeybindHint variant="boxed">Backspace</KeybindHint>
          <span>back</span>
        </>
      ) : (
        <>
          <KeybindHint variant="boxed">↑↓</KeybindHint>
          <span>navigate</span>
          <KeybindHint variant="boxed">Tab</KeybindHint>
          <span>filter / autocomplete</span>
          <KeybindHint variant="boxed">Enter</KeybindHint>
          <span>open</span>
          <KeybindHint variant="boxed">Esc</KeybindHint>
          <span>close</span>
          <KeybindHint variant="boxed">?</KeybindHint>
          <span>help</span>
          {(canClearContext || canPopScope) && (
            <>
              <KeybindHint variant="boxed">Backspace</KeybindHint>
              <span>{canPopScope ? 'remove scope' : 'clear context'}</span>
            </>
          )}
        </>
      )}
    </div>
  )
}
