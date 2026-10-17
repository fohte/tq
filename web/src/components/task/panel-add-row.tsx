import { Button } from '@fohte/ui/button'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

type PanelAddRowProps = {
  icon: LucideIcon
  label: string
  onClick: () => void
  disabled?: boolean
  trailing?: ReactNode
}

export function PanelAddRow({
  icon: Icon,
  label,
  onClick,
  disabled,
  trailing,
}: PanelAddRowProps) {
  return (
    <div className="flex items-center border-t border-dashed border-border px-3 font-mono text-xs">
      <Button
        type="button"
        variant="plain"
        disabled={disabled}
        onClick={onClick}
        className="min-h-11 flex-1 self-stretch justify-start text-left whitespace-normal"
      >
        <span className="flex items-center gap-1.5">
          <Icon className="size-3" />
          {label}
        </span>
      </Button>
      {trailing}
    </div>
  )
}
