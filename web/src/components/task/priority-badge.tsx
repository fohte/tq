export function PriorityBadge({ name }: { name: string }) {
  return (
    <span
      data-testid="priority-badge"
      className="ml-1.5 inline-flex items-center rounded-sm bg-secondary px-1.5 py-0.5 text-2xs text-secondary-foreground"
    >
      {name}
    </span>
  )
}
