import { Chip } from '@fohte/ui/chip'

import { SEARCH_MODE_DEFINITIONS } from '#components/search/search-modal-mode'

const searchModes = [
  { label: 'all', prefix: undefined },
  ...Object.entries(SEARCH_MODE_DEFINITIONS).map(([prefix, { label }]) => ({
    label: `${prefix} ${label.toLowerCase()}`,
    prefix,
  })),
]

interface SearchModalModeSwitcherProps {
  modePrefix?: string | undefined
  onModeChange: (prefix: string | undefined) => void
}

export function SearchModalModeSwitcher({
  modePrefix,
  onModeChange,
}: SearchModalModeSwitcherProps) {
  return (
    <div
      className="flex shrink-0 gap-0.5 overflow-x-auto border-b border-border px-3 py-1.5 md:hidden"
      role="group"
      aria-label="Search mode"
    >
      {searchModes.map(({ label, prefix }) => (
        <span key={label} className="flex h-8 shrink-0 whitespace-nowrap">
          <Chip
            as="button"
            size="md"
            tone={modePrefix === prefix ? 'strong' : 'muted'}
            aria-pressed={modePrefix === prefix}
            onClick={() => {
              onModeChange(prefix)
            }}
          >
            {label}
          </Chip>
        </span>
      ))}
    </div>
  )
}
