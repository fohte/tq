import { Loader2, X } from 'lucide-react'

import type { SearchMode } from '#components/search/search-modal-mode'
import { Chip } from '#components/ui/chip'
import { KeybindHint } from '#components/ui/keybind-hint'
import type { SearchScopeLabel } from '#hooks/use-search-scope-labels'

interface SearchModalInputProps {
  modePrefix?: string | undefined
  context?: 'work' | 'personal' | undefined
  searchScopeTokens: SearchScopeLabel[]
  searchInputValue: string
  searchTarget: SearchMode
  isFetching: boolean
  onInputValueChange: (value: string) => void
  onRemoveContext: () => void
  onRemoveScopeToken: (index: number) => void
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
  onRemoveContext,
  onRemoveScopeToken,
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
        <Chip
          size="md"
          active
          className="max-w-32 gap-1 py-px pr-0.5"
          data-testid="search-context-scope"
          title={`context:${context}`}
        >
          <span className="min-w-0 truncate">context:{context}</span>
          <button
            type="button"
            aria-label={`Remove context:${context} scope`}
            className="shrink-0 text-muted-foreground-faint hover:text-destructive"
            onClick={onRemoveContext}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.stopPropagation()
              }
            }}
          >
            <X className="h-2.5 w-2.5" aria-hidden="true" />
          </button>
        </Chip>
      )}
      {searchScopeTokens.map(({ token, label }, index) => (
        <Chip
          key={`${token}-${String(index)}`}
          size="md"
          active
          className="max-w-32 gap-1 py-px pr-0.5"
          data-testid="search-scope-token"
          title={label}
        >
          <span className="min-w-0 truncate">{label}</span>
          <button
            type="button"
            aria-label={`Remove ${label} scope`}
            className="shrink-0 text-muted-foreground-faint hover:text-destructive"
            onClick={() => {
              onRemoveScopeToken(index)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.stopPropagation()
              }
            }}
          >
            <X className="h-2.5 w-2.5" aria-hidden="true" />
          </button>
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
