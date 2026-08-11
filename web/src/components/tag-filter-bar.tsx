import { Chip } from '#components/ui/chip'
import { useTagFilter } from '#hooks/use-tag-filter'

/**
 * Shows which tag the current view is filtered by. Renders nothing when no
 * tag filter is active.
 */
export function TagFilterBar() {
  const { tag, setTag } = useTagFilter()

  if (tag == null) {
    return null
  }

  return (
    <div className="flex items-center gap-2 border-b border-border px-3 py-[7px]">
      <span className="font-mono text-2xs whitespace-nowrap text-muted-foreground-faint">
        filtered by
      </span>
      <Chip size="md" active>
        <span className="text-primary font-bold">#</span>
        {tag}
      </Chip>
      <button
        type="button"
        onClick={() => {
          setTag(null)
        }}
        className="font-mono text-2xs text-muted-foreground"
      >
        clear
      </button>
    </div>
  )
}
