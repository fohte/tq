import { SEARCH_MODE_DEFINITIONS } from '#components/search/search-modal-mode'
import { Chip } from '#components/ui/chip'

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
        <Chip
          key={label}
          as="button"
          size="md"
          active={modePrefix === prefix}
          aria-pressed={modePrefix === prefix}
          className="min-h-8 shrink-0 whitespace-nowrap px-1"
          onClick={() => {
            onModeChange(prefix)
          }}
        >
          {label}
        </Chip>
      ))}
    </div>
  )
}
