export function TaskListColumnHeader() {
  return (
    <div className="hidden grid-cols-(--task-row-columns) items-center gap-2 border-b border-border bg-card px-3 py-1.5 font-mono text-2xs tracking-widest text-muted-foreground-faint md:grid">
      <span />
      <span />
      <span>TITLE</span>
      <span>TAGS</span>
      <span>LINK</span>
      <span className="text-right">EST</span>
      <span className="text-right">DUE</span>
      <span />
    </div>
  )
}
