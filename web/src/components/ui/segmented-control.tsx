import { cn } from '@web/lib/utils'

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  containerClassName,
  activeClassName,
  inactiveClassName,
}: {
  value: T
  options: ReadonlyArray<{ value: T; label: string }>
  onChange: (value: T) => void
  containerClassName?: string
  activeClassName: string
  inactiveClassName: string
}) {
  return (
    <div className={cn('flex items-center gap-1', containerClassName)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => {
            onChange(option.value)
          }}
          className={cn(
            'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
            value === option.value ? activeClassName : inactiveClassName,
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
