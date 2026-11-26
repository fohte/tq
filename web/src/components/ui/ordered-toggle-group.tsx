import { cn } from '#lib/utils'

function nextValues<T>(values: T[], pressed: T): T[] {
  if (!values.includes(pressed)) return [...values, pressed]
  return values.length === 1
    ? values
    : values.filter((value) => value !== pressed)
}

export function OrderedToggleGroup<T extends string>({
  values,
  options,
  onValuesChange,
}: {
  values: T[]
  options: ReadonlyArray<{ value: T; label: string }>
  onValuesChange: (values: T[]) => void
}) {
  return (
    <div
      role="group"
      className="inline-flex items-center border border-border bg-secondary p-0.5"
    >
      {options.map((option) => {
        const rank = values.indexOf(option.value) + 1
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={rank > 0}
            className={cn(
              'relative grow rounded-none px-2.5 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
              rank > 0
                ? 'bg-background text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => {
              onValuesChange(nextValues(values, option.value))
            }}
          >
            {option.label}
            {values.length > 1 && rank > 0 && (
              <span className="absolute top-0 right-0.5 text-2xs leading-tight text-muted-foreground">
                {rank}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
