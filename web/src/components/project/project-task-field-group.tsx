export function ProjectTaskFieldGroup({
  title,
  children,
  isError = false,
  hasTasks = false,
}: {
  title: string
  children: React.ReactNode
  isError?: boolean
  hasTasks?: boolean
}) {
  return (
    <section aria-label={`${title} group`} className="border-t border-border">
      <h3 className="px-3 py-2 font-mono text-xs font-bold text-muted-foreground">
        {title}
      </h3>
      {isError && (
        <p
          role="alert"
          className="px-3 py-2 font-mono text-xs text-destructive"
        >
          Failed to load tasks for this group.
        </p>
      )}
      {(!isError || hasTasks) && children}
    </section>
  )
}
