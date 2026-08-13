export function ProjectListHeader() {
  return (
    <div className="hidden grid-cols-(--project-list-columns) border-b border-border bg-card px-3.5 py-1.5 font-mono text-2xs tracking-widest text-muted-foreground-faint md:grid md:items-center md:gap-3">
      <span />
      <span>PROJECT</span>
      <span>STATUS</span>
      <span>PROGRESS</span>
      <span className="text-right">TARGET</span>
    </div>
  )
}
