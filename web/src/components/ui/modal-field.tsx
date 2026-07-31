import { useState } from 'react'

import { cn } from '#lib/utils'

export function InlineFieldGroup({
  label,
  icon,
  children,
}: {
  label: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-1 font-mono text-[9px] tracking-[0.08em] text-muted-foreground-faint">
        {icon}
        {label}
      </span>
      <div className="flex h-7 items-center border border-border px-2 text-xs focus-within:border-ring focus-within:ring-1 focus-within:ring-ring/50">
        {children}
      </div>
    </div>
  )
}

export function ExpandableFieldChip({
  icon,
  label,
  active,
  expanded,
}: {
  icon: React.ReactNode
  label: string
  active?: boolean
  expanded?: (close: () => void) => React.ReactNode
}) {
  const [isEditing, setIsEditing] = useState(false)
  const close = () => {
    setIsEditing(false)
  }

  return (
    <div
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 border px-2.5 py-1.5 text-xs font-mono transition-colors',
        active === true
          ? 'border-border-strong text-foreground'
          : 'border-border text-muted-foreground',
      )}
    >
      {icon}
      {isEditing && expanded != null ? (
        <div
          onBlur={(e) => {
            // A Select's popup mounts in a portal, so it sits outside this
            // div in the DOM — ignore blur events caused by focus moving
            // into it while the popup is still open. Selecting a value
            // closes the chip explicitly via `close()` instead of relying
            // on this blur, since tapping a `role="option"` item doesn't
            // reliably move DOM focus on every platform.
            if (
              e.relatedTarget instanceof Element &&
              e.relatedTarget.closest('[data-slot="select-content"]')
            ) {
              return
            }
            close()
          }}
        >
          {expanded(close)}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setIsEditing(true)
          }}
          className="outline-none"
        >
          {label}
        </button>
      )}
    </div>
  )
}
