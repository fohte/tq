import { cn } from '#lib/utils'

export function TabStrip<T extends string>({
  value,
  options,
  onChange,
  disabled,
  className,
}: {
  value: T
  options: ReadonlyArray<{ value: T; label: React.ReactNode }>
  onChange: (value: T) => void
  disabled?: boolean
  className?: string
}) {
  return (
    <div className={cn('flex', className)}>
      {options.map((option, index) => (
        <button
          key={option.value}
          type="button"
          disabled={disabled}
          onClick={() => {
            onChange(option.value)
          }}
          aria-pressed={value === option.value}
          className={cn(
            'shrink-0 whitespace-nowrap border px-2.5 py-1 font-mono text-2xs',
            value === option.value
              ? 'border-border-strong bg-surface-strong text-foreground'
              : 'border-border text-muted-foreground',
            index > 0 && 'border-l-0',
            (disabled ?? false) && 'cursor-not-allowed opacity-50',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
