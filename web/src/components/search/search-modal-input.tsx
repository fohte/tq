import { Loader2 } from 'lucide-react'

import type { SearchMode } from '#components/search/search-modal-mode'
import { Chip } from '#components/ui/chip'
import { KeybindHint } from '#components/ui/keybind-hint'

interface SearchModalInputProps {
  modePrefix?: string | undefined
  context?: 'work' | 'personal' | undefined
  searchScopeTokens: string[]
  searchInputValue: string
  searchTarget: SearchMode
  isFetching: boolean
  onInputValueChange: (value: string) => void
  inputRef?: React.RefObject<HTMLInputElement | null>
}

export function SearchModalInput({
  modePrefix,
  context,
  searchScopeTokens,
  searchInputValue,
  searchTarget,
  isFetching,
  onInputValueChange,
  inputRef,
}: SearchModalInputProps) {
  return (
    <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-4">
      <span
        className="font-mono text-sm font-bold text-primary"
        data-testid="search-mode-indicator"
        aria-hidden="true"
      >
        {modePrefix ?? '›'}
      </span>
      {context != null && (
        <Chip size="md" active data-testid="search-context-scope">
          context:{context}
        </Chip>
      )}
      {searchScopeTokens.map((scopeToken, index) => (
        <Chip key={index} size="md" active data-testid="search-scope-token">
          {scopeToken}
        </Chip>
      ))}
      <input
        ref={inputRef}
        type="text"
        value={searchInputValue}
        onChange={(e) => {
          onInputValueChange(e.target.value)
        }}
        placeholder={`Search ${searchTarget}...`}
        autoFocus
        className="min-w-0 flex-1 border-0 bg-transparent font-mono text-sm outline-none placeholder:text-muted-foreground"
        aria-label={`Search ${searchTarget}`}
      />
      {isFetching && (
        <Loader2
          className="h-4 w-4 shrink-0 animate-spin text-muted-foreground"
          data-testid="search-loading"
        />
      )}
      <KeybindHint variant="boxed">Esc</KeybindHint>
    </div>
  )
}
