import { cn } from '#lib/utils'

export function ContextBadge({ context }: { context: string }) {
  return (
    <span
      className={cn(
        'rounded-[10px] px-2 py-0.5 text-[11px] font-medium',
        context === 'work' && 'bg-[#3D2020] text-[#FF5C33]',
        context === 'personal' && 'bg-[#3D3320] text-[#FFC14D]',
      )}
    >
      {context}
    </span>
  )
}
