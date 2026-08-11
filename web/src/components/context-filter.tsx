import { TabStrip } from '#components/ui/tab-strip'
import {
  type ContextFilterMode,
  useContextFilter,
} from '#hooks/use-context-filter'
import { cn } from '#lib/utils'

const filterOptions: ReadonlyArray<{
  mode: ContextFilterMode
  label: string
}> = [
  { mode: 'all', label: 'all' },
  { mode: 'work', label: 'work' },
  { mode: 'personal', label: 'personal' },
]

/**
 * 3-column grid variant for the sidebar footer.
 */
export function ContextFilter() {
  const { mode, setMode } = useContextFilter()

  return (
    <div className="grid grid-cols-3">
      {filterOptions.map((option, index) => (
        <button
          key={option.mode}
          type="button"
          onClick={() => {
            setMode(option.mode)
          }}
          aria-pressed={mode === option.mode}
          className={cn(
            'border py-1 font-mono text-2xs',
            mode === option.mode
              ? 'border-border-strong bg-surface-strong text-foreground'
              : 'border-border text-muted-foreground-faint',
            index > 0 && 'border-l-0',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/**
 * Horizontal variant for use in headers or inline contexts.
 */
export function ContextFilterInline() {
  const { mode, setMode } = useContextFilter()

  return (
    <TabStrip
      value={mode}
      options={filterOptions.map((option) => ({
        value: option.mode,
        label: option.label,
      }))}
      onChange={setMode}
    />
  )
}
