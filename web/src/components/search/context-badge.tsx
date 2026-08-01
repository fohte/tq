import { Chip } from '#components/ui/chip'

export function ContextBadge({ context }: { context: string }) {
  return <Chip>{context}</Chip>
}
