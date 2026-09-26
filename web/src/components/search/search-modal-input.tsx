import { Loader2, X } from 'lucide-react'

import type { SearchMode } from '#components/search/search-modal-mode'
import { Button } from '#components/ui/button'
import { Chip } from '#components/ui/chip'
import { Input } from '#components/ui/input'
import { KeybindHint } from '#components/ui/keybind-hint'
import type { SearchScopeLabel } from '#hooks/use-search-scope-labels'

interface SearchModalInputProps {
  modePrefix?: string | undefined
  context?: 'work' | 'personal' | undefined
  searchScopes: SearchScopeLabel[]
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
  searchScopes,
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
        <RemovableScopeChip
          label={`context:${context}`}
          testId="search-context-scope"
          onRemove={onRemoveContext}
        />
      )}
      {searchScopes.map(({ token, label }, index) => (
        <RemovableScopeChip
          key={`${token}-${String(index)}`}
          label={label}
          testId="search-scope-token"
          onRemove={() => {
            onRemoveScopeToken(index)
          }}
        />
      ))}
      <Input
        ref={inputRef}
        type="text"
        value={searchInputValue}
        onChange={(e) => {
          onInputValueChange(e.target.value)
        }}
        placeholder={`Search ${searchTarget}...`}
        autoFocus
        className="h-auto w-auto min-w-0 flex-1 rounded-none border-0 bg-transparent dark:bg-transparent p-0 font-mono text-sm outline-none placeholder:text-muted-foreground focus-visible:border-0 focus-visible:ring-0"
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

function RemovableScopeChip({
  label,
  testId,
  onRemove,
}: {
  label: string
  testId: string
  onRemove: () => void
}) {
  return (
    <Chip
      size="md"
      active
      className="max-w-32 gap-1 py-px pr-0.5"
      data-testid={testId}
      title={label}
    >
      <span className="min-w-0 truncate">{label}</span>
      <Button
        type="button"
        variant="ghost"
        aria-label={`Remove ${label} scope`}
        className="h-auto min-h-0 w-auto shrink-0 gap-0 rounded-none border-0 bg-transparent p-0 font-normal shadow-none transition-none hover:bg-transparent active:translate-y-0 text-muted-foreground-faint hover:text-destructive"
        onClick={onRemove}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.stopPropagation()
          }
        }}
      >
        <X className="size-2.5" aria-hidden="true" />
      </Button>
    </Chip>
  )
}
