import { Hourglass } from 'lucide-react'

export function TaskWaitingIcon() {
  return (
    <span
      role="img"
      aria-label="返事待ち"
      className="flex size-3 shrink-0 items-center justify-center"
    >
      <Hourglass className="size-3" aria-hidden="true" />
    </span>
  )
}
