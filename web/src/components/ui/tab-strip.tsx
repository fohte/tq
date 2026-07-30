import { cn } from '#lib/utils'

export function TabStrip<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T
  options: ReadonlyArray<{ value: T; label: React.ReactNode }>
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <div className={cn('flex', className)}>
      {options.map((option, index) => (
        <button
          key={option.value}
          type="button"
          onClick={() => {
            onChange(option.value)
          }}
          aria-pressed={value === option.value}
          className={cn(
            'shrink-0 whitespace-nowrap border px-[9px] py-[3px] font-mono text-[11px]',
            value === option.value
              ? 'border-border-strong bg-surface-strong text-foreground'
              : 'border-border text-muted-foreground',
            index > 0 && 'border-l-0',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
