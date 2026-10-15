import { Chip } from '@fohte/ui/chip'

import type { SearchScopeLabel } from '#hooks/use-search-scope-labels'

interface SearchModalInputAdornmentProps {
  context?: 'work' | 'personal' | undefined
  searchScopes: SearchScopeLabel[]
  onRemoveContext: () => void
  onRemoveScopeToken: (index: number) => void
}

export function SearchModalInputAdornment({
  context,
  searchScopes,
  onRemoveContext,
  onRemoveScopeToken,
}: SearchModalInputAdornmentProps) {
  return (
    <>
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
    </>
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
