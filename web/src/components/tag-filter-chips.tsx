import { useTagCounts } from '#hooks/use-tag-counts'
import { useTagToggle } from '#hooks/use-tag-filter'
import { cn } from '#lib/utils'

function TagChip({ name, count }: { name: string; count: number }) {
  const { isActive, toggle } = useTagToggle(name)

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={isActive}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 whitespace-nowrap border px-2 py-1 font-mono text-2xs',
        isActive
          ? 'border-border-strong bg-surface-strong text-foreground'
          : 'border-border text-muted-foreground',
      )}
    >
      <span
        className={cn(
          'font-bold',
          isActive ? 'text-primary' : 'text-muted-foreground-faint',
        )}
      >
        #
      </span>
      <span>{name}</span>
      <span className="text-muted-foreground-ghost">{count}</span>
    </button>
  )
}

/**
 * Mobile-only horizontal-scroll row of tag chips, mirroring the sidebar
 * TAGS list's toggle behavior for screens without the sidebar.
 */
export function TagFilterChips() {
  const { tagCounts } = useTagCounts()

  if (tagCounts.length === 0) {
    return null
  }

  return (
    <div className="flex gap-1.5 overflow-x-auto border-b border-border px-3 py-2">
      {tagCounts.map((tagCount) => (
        <TagChip
          key={tagCount.name}
          name={tagCount.name}
          count={tagCount.count}
        />
      ))}
    </div>
  )
}
