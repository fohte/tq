export function GithubBlockerUpdateError({ message }: { message: string }) {
  return (
    <p role="alert" className="px-3 py-2 text-sm text-destructive">
      {message}
    </p>
  )
}
