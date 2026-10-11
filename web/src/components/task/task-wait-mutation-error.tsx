export function TaskWaitMutationError({ message }: { message: string }) {
  return (
    <p role="alert" className="pl-5 text-xs text-destructive">
      {message}
    </p>
  )
}
