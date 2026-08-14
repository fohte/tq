import { cn } from '#lib/utils'

type QueryStateMessageProps =
  | { status: 'loading'; size?: 'xs' }
  | { status: 'error'; message: string; size?: 'xs' }

export function QueryStateMessage(props: QueryStateMessageProps) {
  const sizeClassName = props.size === 'xs' ? 'py-1.5 text-xs' : 'text-sm'

  if (props.status === 'loading') {
    return (
      <p className={cn(sizeClassName, 'text-muted-foreground')}>
        読み込み中...
      </p>
    )
  }

  return (
    <p className={cn(sizeClassName, 'text-destructive')}>{props.message}</p>
  )
}
