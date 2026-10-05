import { Button } from '@fohte/ui/button'
import { Chip } from '@fohte/ui/chip'
import { Input } from '@fohte/ui/input'
import { Loader2, X } from 'lucide-react'

import type { SearchMode } from '#components/search/search-modal-mode'
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
  onClose: () => void
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
  onClose,
  inputRef,
}: SearchModalInputProps) {
  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3 md:gap-3 md:px-4">
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
      <KeybindHint variant="boxed" className="hidden md:inline-flex">
        Esc
      </KeybindHint>
      <Button
        type="button"
        variant="plain"
        aria-label="Close search"
        className="size-9 shrink-0 md:hidden"
        onClick={onClose}
      >
        <X className="size-4" aria-hidden="true" />
      </Button>
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
    <span className="flex max-w-32 min-w-0">
      <Chip
        size="md"
        tone="strong"
        data-testid={testId}
        title={label}
        onRemove={onRemove}
        removeLabel={`Remove ${label} scope`}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.stopPropagation()
          }
        }}
      >
        <span className="min-w-0 max-w-24 truncate">{label}</span>
      </Chip>
    </span>
  )
}
