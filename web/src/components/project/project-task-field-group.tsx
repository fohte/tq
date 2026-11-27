export function ProjectTaskFieldGroup({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section aria-label={`${title} group`} className="border-t border-border">
      <h3 className="px-3 py-2 font-mono text-xs font-bold text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  )
}
